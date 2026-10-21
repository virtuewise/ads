/// <reference types="@webgpu/types" />
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { BrandLUT, TransformState } from '../engine/types';
import { COMPOSITE_SHADER, packUniforms, UNIFORM_BYTES, UNIFORM_FLOATS } from '../engine/visual';

interface WebGPUCanvasProps {
  /** Frame time in seconds; the App's playhead drives this. */
  time?: number;
  transform?: TransformState;
  lut?: BrandLUT | null;
  /** Optional DAG-compiled WGSL shader. Falls back to COMPOSITE_SHADER when absent. */
  shaderCode?: string;
  /** One unified shader per pass for graphs that sample an earlier pass. */
  shaderSegments?: string[];
  /** The pass whose result is presented. */
  outputSegment?: number;
  /** Graph-level errors that prevented the requested shader from compiling. */
  compileError?: string;
  /**
   * The decoded video frame the graph's media source samples. It is handed to
   * the GPU as an external texture on every rendered frame; null falls back to
   * a 1×1 black frame.
   */
  mediaFrame?: VideoFrame | null;
  /**
   * The texture bindings the editor has to paint, by binding number.
   *
   * The compiler reports these for the nodes whose content the editor draws.
   */
  appTextureSlots?: number[];
}

export interface WebGPUCanvasHandle {
  /** Read the current presented frame back to the CPU for scopes. */
  readPixels(): Promise<ImageData | null>;
  /**
   * Paint into the texture a node samples.
   *
   * The slot is the binding number the compiler gave the node. A title, a
   * matte, a shape: the editor draws it in a 2D canvas and hands it over.
   */
  writeAppTexture(slot: number, image: ImageData): void;
}

interface RenderState {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  uniformBuffer: GPUBuffer;
  data: Float32Array;
  passes: RenderPass[];
  targets: GPUTexture[];
  targetWidth: number;
  targetHeight: number;
  outputSegment: number;
  inputSampler: GPUSampler;
  inputFallback: GPUTexture;
  /** Non-filtering sampler: external textures only support nearest sampling. */
  mediaSampler: GPUSampler;
  /** Filtering sampler for the textures the editor paints into. */
  appSampler: GPUSampler;
  /** A 1×1 black frame used when the graph wants media but none is selected. */
  fallbackFrame: VideoFrame | null;
  /** The textures the editor paints into, keyed by binding number. */
  appTextures: Map<number, GPUTexture>;
}

interface RenderPass {
  pipeline: GPURenderPipeline;
  needsMedia: boolean;
  inputBinding: number | null;
  appBindings: number[];
  bindGroup: GPUBindGroup | null;
}

/** The size of a texture the editor paints into. */
const APP_TEXTURE_SIZE = 1024;

/** Binding numbers the compiler reserves for the media texture and its sampler. */
const MEDIA_TEXTURE_BINDING = 1;
const MEDIA_SAMPLER_BINDING = 2;

function ensureAppTexture(state: RenderState, slot: number): GPUTexture {
  const existing = state.appTextures.get(slot);
  if (existing) return existing;
  const texture = state.device.createTexture({
    size: [APP_TEXTURE_SIZE, APP_TEXTURE_SIZE],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  state.appTextures.set(slot, texture);
  return texture;
}

function ensurePassTargets(
  state: RenderState,
  outputSegment: number,
  width: number,
  height: number,
) {
  const count = Math.max(0, outputSegment);
  if (
    state.targetWidth !== width ||
    state.targetHeight !== height ||
    state.targets.length !== count
  ) {
    for (const texture of state.targets) texture.destroy();
    state.targets = Array.from({ length: count }, (_, i) =>
      state.device.createTexture({
        label: `composite-pass-${i}`,
        size: [width, height],
        format: state.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      }),
    );
    state.targetWidth = width;
    state.targetHeight = height;
    for (const pass of state.passes) pass.bindGroup = null;
  }
}

function createPassBindGroup(
  state: RenderState,
  pass: RenderPass,
  index: number,
  external?: GPUExternalTexture,
): GPUBindGroup {
  const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: state.uniformBuffer } }];
  if (pass.needsMedia) {
    if (!external) throw new Error('The media texture is not available for this pass');
    entries.push(
      { binding: MEDIA_TEXTURE_BINDING, resource: external },
      { binding: MEDIA_SAMPLER_BINDING, resource: state.mediaSampler },
    );
  }
  if (pass.inputBinding !== null) {
    const input = index > 0 ? state.targets[index - 1] : state.inputFallback;
    entries.push(
      { binding: pass.inputBinding, resource: input.createView() },
      { binding: pass.inputBinding + 1, resource: state.inputSampler },
    );
  }
  for (const slot of pass.appBindings) {
    entries.push(
      { binding: slot, resource: ensureAppTexture(state, slot).createView() },
      { binding: slot + 1, resource: state.appSampler },
    );
  }
  return state.device.createBindGroup({ layout: pass.pipeline.getBindGroupLayout(0), entries });
}

interface CaptureRequest {
  resolve: (image: ImageData | null) => void;
  inFlight: boolean;
  timeout: number;
}

export const WebGPUCanvas = forwardRef<WebGPUCanvasHandle, WebGPUCanvasProps>(function WebGPUCanvas(
  {
    time = 0,
    transform,
    lut,
    shaderCode,
    shaderSegments,
    outputSegment = 0,
    compileError,
    mediaFrame = null,
    appTextureSlots = [],
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RenderState | null>(null);
  const captureRef = useRef<CaptureRequest | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [status, setStatus] = useState<'init' | 'compiling' | 'ready' | 'error'>('init');
  const [errorMsg, setErrorMsg] = useState('');

  // Latest props, read by the persistent render loop without re-initialising.
  const propsRef = useRef({
    time,
    transform,
    lut,
    shaderCode,
    shaderSegments,
    outputSegment,
    mediaFrame,
    appTextureSlots,
  });
  propsRef.current = {
    time,
    transform,
    lut,
    shaderCode,
    shaderSegments,
    outputSegment,
    mediaFrame,
    appTextureSlots,
  };

  useImperativeHandle(
    ref,
    () => ({
      readPixels: () => {
        const state = stateRef.current;
        if (!state || state.passes.length === 0 || captureRef.current) return Promise.resolve(null);

        return new Promise<ImageData | null>((resolve) => {
          const request: CaptureRequest = {
            resolve,
            inFlight: false,
            timeout: window.setTimeout(() => {
              if (captureRef.current === request) {
                captureRef.current = null;
                resolve(null);
              }
            }, 2000),
          };
          captureRef.current = request;
        });
      },
      writeAppTexture: (slot: number, image: ImageData) => {
        const state = stateRef.current;
        const texture = state?.appTextures.get(slot);
        if (!texture || !state) return;
        state.device.queue.writeTexture(
          { texture },
          image.data,
          { bytesPerRow: image.width * 4, rowsPerImage: image.height },
          { width: image.width, height: image.height },
        );
      },
    }),
    [],
  );

  /**
   * The textures the editor paints into are created as soon as the graph asks
   * for them, not when the pipeline is rebuilt.
   *
   * The editor paints into them in the same commit that asks for them, and a
   * child effect runs before its parent's — so the texture has to exist by then,
   * or the paint is silently dropped and the title never appears.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the device is published through a ref, so the effect has to re-run when it becomes ready
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    for (const slot of appTextureSlots) {
      ensureAppTexture(state, slot);
    }
  }, [appTextureSlots, deviceReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    let frameId = 0;
    let device: GPUDevice | null = null;
    let observer: ResizeObserver | null = null;

    const settleCapture = (image: ImageData | null) => {
      const request = captureRef.current;
      if (!request) return;
      captureRef.current = null;
      window.clearTimeout(request.timeout);
      request.resolve(image);
    };

    (async () => {
      try {
        if (!navigator.gpu) {
          setStatus('error');
          setErrorMsg('WebGPU not supported in this environment');
          return;
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setStatus('error');
          setErrorMsg('No GPU adapter found');
          return;
        }
        device = await adapter.requestDevice();
        if (destroyed) return;
        const gpu = device;

        const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
        if (!context) {
          setStatus('error');
          setErrorMsg('Could not create a WebGPU canvas context');
          return;
        }

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
          device: gpu,
          format,
          alphaMode: 'premultiplied',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });

        const uniformBuffer = gpu.createBuffer({
          size: UNIFORM_BYTES,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // The media texture the graph's media source samples. It is an
        // *external* texture: the decoded VideoFrame goes to the GPU without a
        // copy, which is why the bind group has to be rebuilt every frame —
        // an imported external texture expires at the end of the task.
        // External textures only support nearest sampling, so the media
        // sampler must not filter.
        const mediaSampler = gpu.createSampler({
          magFilter: 'nearest',
          minFilter: 'nearest',
          mipmapFilter: 'nearest',
        });
        // The textures the editor paints into are ordinary images, and want
        // smooth edges: a title's glyphs must not look like stairs.
        const appSampler = gpu.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge',
        });
        const inputSampler = gpu.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge',
        });
        const inputFallback = gpu.createTexture({
          size: [1, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        gpu.queue.writeTexture(
          { texture: inputFallback },
          new Uint8Array([0, 0, 0, 255]),
          { bytesPerRow: 4 },
          { width: 1, height: 1 },
        );
        const fallbackFrame = new VideoFrame(new Uint8Array([0, 0, 0, 255]), {
          format: 'RGBA',
          codedWidth: 1,
          codedHeight: 1,
          timestamp: 0,
        });

        const state: RenderState = {
          device: gpu,
          context,
          format,
          uniformBuffer,
          data: new Float32Array(UNIFORM_FLOATS),
          passes: [],
          targets: [],
          targetWidth: 0,
          targetHeight: 0,
          outputSegment: 0,
          inputSampler,
          inputFallback,
          mediaSampler,
          appSampler,
          fallbackFrame,
          appTextures: new Map(),
        };
        stateRef.current = state;

        gpu.addEventListener('uncapturederror', (event) => {
          if (destroyed) return;
          setStatus('error');
          setErrorMsg((event as GPUUncapturedErrorEvent).error.message);
        });

        // A validation error must be visible. Without this the viewport
        // silently paints black when a graph compiles to invalid WGSL.
        gpu.lost.then((info) => {
          if (destroyed) return;
          setStatus('error');
          setErrorMsg(`GPU device lost: ${info.message || info.reason}`);
        });

        const resize = () => {
          canvas.width = Math.max(1, Math.floor(canvas.clientWidth * devicePixelRatio));
          canvas.height = Math.max(1, Math.floor(canvas.clientHeight * devicePixelRatio));
        };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(canvas);

        const swizzleBgra = format.startsWith('bgra');

        const readCapture = async (texture: GPUTexture) => {
          const width = texture.width;
          const height = texture.height;
          const unpaddedBytesPerRow = width * 4;
          const bytesPerRow = Math.ceil(unpaddedBytesPerRow / 256) * 256;
          const buffer = gpu.createBuffer({
            size: bytesPerRow * height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          });

          const encoder = gpu.createCommandEncoder({ label: 'scope-readback' });
          encoder.copyTextureToBuffer(
            { texture },
            { buffer, bytesPerRow, rowsPerImage: height },
            { width, height, depthOrArrayLayers: 1 },
          );
          gpu.queue.submit([encoder.finish()]);

          try {
            await buffer.mapAsync(GPUMapMode.READ);
            const mapped = new Uint8Array(buffer.getMappedRange());
            const pixels = new Uint8ClampedArray(width * height * 4);
            for (let y = 0; y < height; y++) {
              const sourceStart = y * bytesPerRow;
              const targetStart = y * unpaddedBytesPerRow;
              pixels.set(
                mapped.subarray(sourceStart, sourceStart + unpaddedBytesPerRow),
                targetStart,
              );
            }
            buffer.unmap();

            if (swizzleBgra) {
              for (let i = 0; i < pixels.length; i += 4) {
                const b = pixels[i];
                pixels[i] = pixels[i + 2];
                pixels[i + 2] = b;
              }
            }
            if (!destroyed) settleCapture(new ImageData(pixels, width, height));
          } catch {
            if (!destroyed) settleCapture(null);
          } finally {
            buffer.destroy();
          }
        };

        const render = () => {
          if (destroyed) return;
          const width = canvas.width || 1;
          const height = canvas.height || 1;
          packUniforms(state.data, {
            time: propsRef.current.time,
            width,
            height,
            transform: propsRef.current.transform,
            lut: propsRef.current.lut,
          });
          gpu.queue.writeBuffer(uniformBuffer, 0, state.data);
          const outputSegment = Math.min(
            Math.max(0, propsRef.current.outputSegment),
            Math.max(0, state.passes.length - 1),
          );
          ensurePassTargets(state, outputSegment, width, height);
          state.outputSegment = outputSegment;
          const texture = context.getCurrentTexture();
          const encoder = gpu.createCommandEncoder({ label: 'viewport' });
          for (let i = 0; i <= outputSegment && i < state.passes.length; i += 1) {
            const renderPass = state.passes[i];
            const target = i === outputSegment ? texture : state.targets[i];
            const frame = propsRef.current.mediaFrame ?? state.fallbackFrame;
            let bindGroup = renderPass.bindGroup;
            try {
              if (renderPass.needsMedia) {
                if (!frame) continue;
                const external = gpu.importExternalTexture({ source: frame });
                bindGroup = createPassBindGroup(state, renderPass, i, external);
              } else if (!bindGroup) {
                bindGroup = createPassBindGroup(state, renderPass, i);
                renderPass.bindGroup = bindGroup;
              }
            } catch (e) {
              if (!destroyed) console.warn('render pass bind failed:', e);
              continue;
            }
            const pass = encoder.beginRenderPass({
              colorAttachments: [
                {
                  view: target.createView(),
                  clearValue: { r: 0.04, g: 0.05, b: 0.08, a: 1 },
                  loadOp: 'clear',
                  storeOp: 'store',
                },
              ],
            });
            pass.setPipeline(renderPass.pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);
            pass.end();
          }
          gpu.queue.submit([encoder.finish()]);
          const request = captureRef.current;
          if (request && !request.inFlight) {
            request.inFlight = true;
            void readCapture(texture);
          }
          frameId = requestAnimationFrame(render);
        };

        setDeviceReady(true);
        render();
      } catch (e) {
        if (!destroyed) {
          setStatus('error');
          setErrorMsg(String(e));
        }
      }
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      settleCapture(null);
      const state = stateRef.current;
      if (state) {
        for (const target of state.targets) target.destroy();
        for (const appTexture of state.appTextures.values()) appTexture.destroy();
        state.inputFallback.destroy();
        state.fallbackFrame?.close();
        state.uniformBuffer.destroy();
      }
      stateRef.current = null;
      device?.destroy();
    };
  }, []);

  // Compile every shader in the graph and keep the prior usable pipelines until all
  // passes validate successfully.
  useEffect(() => {
    const state = stateRef.current;
    if (!deviceReady || !state) return;
    let cancelled = false;
    const sources = shaderSegments?.length ? shaderSegments : [shaderCode ?? COMPOSITE_SHADER];
    setStatus('compiling');

    (async () => {
      try {
        const passes: RenderPass[] = [];
        for (let index = 0; index < sources.length; index += 1) {
          const source = sources[index];
          const module = state.device.createShaderModule({
            code: source,
            label: `viewport-pass-${index}`,
          });
          const info = await module.getCompilationInfo();
          if (cancelled) return;
          const messages = info.messages.filter((message) => message.type === 'error');
          if (messages.length > 0) {
            setStatus('error');
            setErrorMsg(
              messages
                .slice(0, 6)
                .map(
                  (message) =>
                    'pass ' +
                    (index + 1) +
                    ', line ' +
                    message.lineNum +
                    ':' +
                    message.linePos +
                    ' — ' +
                    message.message,
                )
                .join('\n'),
            );
            return;
          }

          state.device.pushErrorScope('validation');
          let pipeline: GPURenderPipeline;
          try {
            pipeline = state.device.createRenderPipeline({
              layout: 'auto',
              vertex: { module, entryPoint: 'vs' },
              fragment: { module, entryPoint: 'fs', targets: [{ format: state.format }] },
              primitive: { topology: 'triangle-list' },
            });
          } catch (error) {
            await state.device.popErrorScope();
            if (!cancelled) {
              setStatus('error');
              setErrorMsg(`pass ${index + 1}: ${String(error)}`);
            }
            return;
          }
          const validation = await state.device.popErrorScope();
          if (cancelled) return;
          if (validation) {
            setStatus('error');
            setErrorMsg(`pass ${index + 1}: ${validation.message}`);
            return;
          }

          const input = source.match(/@binding\((\d+)\)\s+var\s+seg_in\s*:/);
          const appBindings = [
            ...source.matchAll(/@binding\((\d+)\)\s+var\s+\w+_tex\d+\s*:\s*texture_2d<f32>/g),
          ].map((match) => Number(match[1]));
          for (const slot of appBindings) ensureAppTexture(state, slot);
          passes.push({
            pipeline,
            needsMedia: /var\s+media_tex\s*:\s*texture_external/.test(source),
            inputBinding: input ? Number(input[1]) : null,
            appBindings,
            bindGroup: null,
          });
        }
        for (const target of state.targets) target.destroy();
        state.targets = [];
        state.targetWidth = 0;
        state.targetHeight = 0;
        state.passes = passes;
        state.outputSegment = Math.min(Math.max(0, outputSegment), Math.max(0, passes.length - 1));
        setStatus('ready');
        setErrorMsg('');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(String(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceReady, shaderCode, shaderSegments, outputSegment]);

  return (
    <div className="relative w-full h-full bg-ink">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {status === 'init' && (
        <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
          Initializing WebGPU…
        </div>
      )}
      {status === 'compiling' && (
        <div className="absolute right-3 top-3 rounded-md border border-line bg-ink/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur">
          Compiling graph…
        </div>
      )}
      {compileError ? (
        <div
          className="absolute inset-x-3 bottom-3 max-h-36 overflow-auto rounded-md border border-warning/40 bg-ink/95 p-3 font-mono text-[10px] leading-relaxed text-warning shadow-xl"
          role="alert"
        >
          <div className="mb-1 font-sans text-[11px] font-medium">Graph compile error</div>
          <pre className="whitespace-pre-wrap">{compileError}</pre>
        </div>
      ) : status === 'error' ? (
        <div className="absolute inset-x-3 bottom-3 max-h-36 overflow-auto rounded-md border border-warning/40 bg-ink/95 p-3 font-mono text-[10px] leading-relaxed text-warning shadow-xl">
          <div className="mb-1 font-sans text-[11px] font-medium">GPU shader error</div>
          <pre className="whitespace-pre-wrap">{errorMsg}</pre>
        </div>
      ) : null}
    </div>
  );
});
