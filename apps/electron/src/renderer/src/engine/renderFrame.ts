// ── Offline Frame Renderer ───────────────────────────────────────────────────
// Render the same graph passes used by the interactive viewport, then read the
// final texture back for FFmpeg. Graph-free callers retain the procedural
// composite fallback.

/// <reference types="@webgpu/types" />
import type { BridgeResult } from './bridge';
import type { BrandLUT, TransformState } from './types';
import { COMPOSITE_SHADER, packUniforms, UNIFORM_BYTES, UNIFORM_FLOATS } from './visual';

export interface FrameInputs {
  program?: BridgeResult;
  mediaFrame?: VideoFrame | null;
  appTextures?: Record<number, ImageData>;
}

export interface FrameRendererOptions {
  width: number;
  height: number;
  lut?: BrandLUT | null;
}

export interface FrameRenderer {
  /** Render one frame at `time` and resolve with tightly packed RGBA bytes. */
  render(time: number, transform?: TransformState, inputs?: FrameInputs): Promise<Uint8Array>;
  /** Pixel dimensions of each rendered frame. */
  readonly width: number;
  readonly height: number;
  dispose(): void;
}

interface ProgramPass {
  pipeline: GPURenderPipeline;
  needsMedia: boolean;
  inputBinding: number | null;
  appBindings: number[];
  bindGroup: GPUBindGroup | null;
}

interface Program {
  passes: ProgramPass[];
  outputSegment: number;
}

/** Round up to WebGPU's 256-byte row alignment requirement. */
function alignRow(width: number): number {
  return Math.ceil((width * 4) / 256) * 256;
}

/**
 * Create a headless WebGPU frame renderer. Resolves to null when WebGPU is
 * unavailable so callers can fall back gracefully.
 */
export async function createFrameRenderer(
  options: FrameRendererOptions,
): Promise<FrameRenderer | null> {
  if (!navigator.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;
  const device = await adapter.requestDevice();

  const { width, height } = options;
  const bytesPerRow = alignRow(width);
  const padded = bytesPerRow * height;
  const format: GPUTextureFormat = 'rgba8unorm';
  const uniformBuffer = device.createBuffer({
    size: UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const output = device.createTexture({
    size: { width, height },
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
  const staging = device.createBuffer({
    size: padded,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const mediaSampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
  const appSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });
  const inputSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });
  const inputFallback = device.createTexture({
    size: [1, 1],
    format,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture: inputFallback },
    new Uint8Array([0, 0, 0, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1 },
  );
  let fallbackFrame: VideoFrame | null = null;
  const programs = new Map<BridgeResult, Promise<Program>>();
  const fallbackProgram: BridgeResult = { wgsl: COMPOSITE_SHADER, ok: true, errors: [] };
  const targets: GPUTexture[] = [];
  const appTextures = new Map<number, GPUTexture>();
  const uniforms = new Float32Array(UNIFORM_FLOATS);
  const tight = bytesPerRow === width * 4 ? null : new Uint8Array(width * 4 * height);
  let disposed = false;

  const ensureAppTexture = (slot: number, image?: ImageData): GPUTexture => {
    const existing = appTextures.get(slot);
    const targetWidth = image?.width ?? 1024;
    const targetHeight = image?.height ?? 1024;
    if (existing && existing.width === targetWidth && existing.height === targetHeight)
      return existing;
    existing?.destroy();
    const texture = device.createTexture({
      size: [targetWidth, targetHeight],
      format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    appTextures.set(slot, texture);
    // Bind groups hold views of the old texture; rebuild them the next time
    // each cached program is rendered.
    for (const programPromise of programs.values()) {
      void programPromise
        .then((program) => {
          for (const pass of program.passes) pass.bindGroup = null;
        })
        .catch(() => undefined);
    }
    return texture;
  };

  const compileProgram = async (program: BridgeResult): Promise<Program> => {
    const sources = program.segments?.length ? program.segments : [program.wgsl];
    const outputSegment = Math.min(
      Math.max(0, program.outputSegment ?? 0),
      Math.max(0, sources.length - 1),
    );
    const passes: ProgramPass[] = [];
    for (let index = 0; index <= outputSegment; index += 1) {
      const source = sources[index];
      const module = device.createShaderModule({ code: source, label: `export-pass-${index}` });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter((message) => message.type === 'error');
      if (errors.length > 0) {
        throw new Error(
          errors
            .slice(0, 6)
            .map(
              (message) =>
                `pass ${index + 1}, line ${message.lineNum}:${message.linePos} — ${message.message}`,
            )
            .join('\n'),
        );
      }
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      const input = source.match(/@binding\((\d+)\)\s+var\s+seg_in\s*:/);
      const appSlots = Object.values(
        program.appTextures ?? program.compiled?.appTextures ?? {},
      ).map((binding) => binding.texture);
      const appBindings = [
        ...source.matchAll(/@binding\((\d+)\)\s+var\s+\w+_tex\d+\s*:\s*texture_2d<f32>/g),
      ]
        .map((match) => Number(match[1]))
        .filter((binding) => appSlots.includes(binding));
      for (const slot of appBindings) ensureAppTexture(slot);
      passes.push({
        pipeline,
        needsMedia: /var\s+media_tex\s*:\s*texture_external/.test(source),
        inputBinding: input ? Number(input[1]) : null,
        appBindings,
        bindGroup: null,
      });
    }
    while (targets.length < outputSegment) {
      const index = targets.length;
      targets.push(
        device.createTexture({
          label: `export-intermediate-${index}`,
          size: { width, height },
          format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        }),
      );
    }
    return { passes, outputSegment };
  };

  const getProgram = (program?: BridgeResult): Promise<Program> => {
    const active = program ?? fallbackProgram;
    let pending = programs.get(active);
    if (!pending) {
      pending = compileProgram(active);
      programs.set(active, pending);
    }
    return pending;
  };

  const getFallbackFrame = (): VideoFrame => {
    fallbackFrame ??= new VideoFrame(new Uint8Array([0, 0, 0, 255]), {
      format: 'RGBA',
      codedWidth: 1,
      codedHeight: 1,
      timestamp: 0,
    });
    return fallbackFrame;
  };

  return {
    width,
    height,
    async render(
      time: number,
      transform?: TransformState,
      inputs: FrameInputs = {},
    ): Promise<Uint8Array> {
      if (disposed) throw new Error('Frame renderer has been disposed');
      const program = await getProgram(inputs.program);
      for (const [slotText, image] of Object.entries(inputs.appTextures ?? {})) {
        const slot = Number(slotText);
        const texture = ensureAppTexture(slot, image);
        device.queue.writeTexture(
          { texture },
          image.data,
          { bytesPerRow: image.width * 4, rowsPerImage: image.height },
          { width: image.width, height: image.height },
        );
      }

      packUniforms(uniforms, { time, width, height, transform, lut: options.lut ?? null });
      device.queue.writeBuffer(uniformBuffer, 0, uniforms);

      const encoder = device.createCommandEncoder({ label: 'export-frame' });
      for (let index = 0; index <= program.outputSegment; index += 1) {
        const passState = program.passes[index];
        const target = index === program.outputSegment ? output : targets[index];
        const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: uniformBuffer } }];
        if (passState.needsMedia) {
          const frame = inputs.mediaFrame ?? getFallbackFrame();
          const external = device.importExternalTexture({ source: frame });
          entries.push({ binding: 1, resource: external }, { binding: 2, resource: mediaSampler });
        }
        if (passState.inputBinding !== null) {
          entries.push(
            {
              binding: passState.inputBinding,
              resource: (index > 0 ? targets[index - 1] : inputFallback).createView(),
            },
            { binding: passState.inputBinding + 1, resource: inputSampler },
          );
        }
        for (const slot of passState.appBindings) {
          entries.push(
            { binding: slot, resource: ensureAppTexture(slot).createView() },
            { binding: slot + 1, resource: appSampler },
          );
        }
        const bindGroup =
          passState.needsMedia || !passState.bindGroup
            ? device.createBindGroup({ layout: passState.pipeline.getBindGroupLayout(0), entries })
            : passState.bindGroup;
        if (!passState.needsMedia) passState.bindGroup = bindGroup;

        const renderPass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: target.createView(),
              clearValue: { r: 0.04, g: 0.05, b: 0.08, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        renderPass.setPipeline(passState.pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(6);
        renderPass.end();
      }
      encoder.copyTextureToBuffer(
        { texture: output },
        { buffer: staging, bytesPerRow, rowsPerImage: height },
        { width, height },
      );
      device.queue.submit([encoder.finish()]);

      await staging.mapAsync(GPUMapMode.READ);
      const mapped = new Uint8Array(staging.getMappedRange());
      let result: Uint8Array;
      if (bytesPerRow === width * 4) {
        result = mapped.slice();
      } else {
        const out = tight as Uint8Array;
        for (let y = 0; y < height; y += 1) {
          out.set(mapped.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
        }
        result = out.slice();
      }
      staging.unmap();
      return result;
    },
    dispose() {
      disposed = true;
      for (const texture of appTextures.values()) texture.destroy();
      for (const texture of targets) texture.destroy();
      fallbackFrame?.close();
      inputFallback.destroy();
      output.destroy();
      staging.destroy();
      uniformBuffer.destroy();
      device.destroy();
    },
  };
}
