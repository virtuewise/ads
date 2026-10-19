// ── Offline Frame Renderer ───────────────────────────────────────────────────
// Renders composition frames headlessly (no canvas) straight into RGBA byte
// buffers, so export never depends on what is on screen. Uses the same WGSL and
// uniform packing as the interactive viewport, which is what guarantees "what
// you see is what you export".

/// <reference types="@webgpu/types" />
import type { BrandLUT, TransformState } from './types';
import { COMPOSITE_SHADER, packUniforms, UNIFORM_BYTES, UNIFORM_FLOATS } from './visual';

export interface FrameRendererOptions {
  width: number;
  height: number;
  lut?: BrandLUT | null;
}

export interface FrameRenderer {
  /** Render one frame at `time` and resolve with tightly packed RGBA bytes. */
  render(time: number, transform?: TransformState): Promise<Uint8Array>;
  /** Pixel dimensions of each rendered frame. */
  readonly width: number;
  readonly height: number;
  dispose(): void;
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

  const shaderModule = device.createShaderModule({ code: COMPOSITE_SHADER });
  const uniformBuffer = device.createBuffer({
    size: UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule, entryPoint: 'vs' },
    fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const texture = device.createTexture({
    size: { width, height },
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const staging = device.createBuffer({
    size: padded,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const uniforms = new Float32Array(UNIFORM_FLOATS);
  const tight = bytesPerRow === width * 4 ? null : new Uint8Array(width * 4 * height);
  let disposed = false;

  return {
    width,
    height,
    async render(time: number, transform?: TransformState): Promise<Uint8Array> {
      if (disposed) throw new Error('Frame renderer has been disposed');
      packUniforms(uniforms, { time, width, height, transform, lut: options.lut ?? null });
      device.queue.writeBuffer(uniformBuffer, 0, uniforms);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: texture.createView(),
            clearValue: { r: 0.04, g: 0.05, b: 0.08, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6);
      pass.end();
      encoder.copyTextureToBuffer(
        { texture },
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
      texture.destroy();
      staging.destroy();
      uniformBuffer.destroy();
      device.destroy();
    },
  };
}
