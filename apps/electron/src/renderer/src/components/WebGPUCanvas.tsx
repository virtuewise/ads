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
  /**
   * The decoded video frame the graph's media source samples. It is handed to
   * the GPU as an external texture on every rendered frame; null falls back to
   * a 1×1 black frame.
   */
  mediaFrame?: VideoFrame | null;
}

export interface WebGPUCanvasHandle {
  /** Read the current presented frame back to the CPU for scopes. */
  readPixels(): Promise<ImageData | null>;
}

interface RenderState {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  uniformBuffer: GPUBuffer;
  data: Float32Array;
  pipeline: GPURenderPipeline | null;
  bindGroup: GPUBindGroup | null;
  /** True when the shader samples a media texture. */
  needsMedia: boolean;
  /** Non-filtering sampler: external textures only support nearest sampling. */
  mediaSampler: GPUSampler;
  /** A 1×1 black frame used when the graph wants media but none is selected. */
  fallbackFrame: VideoFrame | null;
}

/** Binding numbers the compiler reserves for the media texture and its sampler. */
const MEDIA_TEXTURE_BINDING = 1;
const MEDIA_SAMPLER_BINDING = 2;

interface CaptureRequest {
  resolve: (image: ImageData | null) => void;
  inFlight: boolean;
  timeout: number;
}

export const WebGPUCanvas = forwardRef<WebGPUCanvasHandle, WebGPUCanvasProps>(function WebGPUCanvas(
  { time = 0, transform, lut, shaderCode, mediaFrame = null },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RenderState | null>(null);
  const captureRef = useRef<CaptureRequest | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [status, setStatus] = useState<'init' | 'compiling' | 'ready' | 'error'>('init');
  const [errorMsg, setErrorMsg] = useState('');

  // Latest props, read by the persistent render loop without re-initialising.
  const propsRef = useRef({ time, transform, lut, shaderCode, mediaFrame });
  propsRef.current = { time, transform, lut, shaderCode, mediaFrame };

  useImperativeHandle(
    ref,
    () => ({
      readPixels: () => {
        const state = stateRef.current;
        if (!state?.pipeline || captureRef.current) return Promise.resolve(null);

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
    }),
    [],
  );

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
          pipeline: null,
          bindGroup: null,
          needsMedia: false,
          mediaSampler,
          fallbackFrame,
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

          // Bind the current media frame. The decoded VideoFrame is imported as
          // an external texture, so the pixels reach the GPU without a copy —
          // but an external texture expires at the end of the task, so the
          // bind group is rebuilt for every frame.
          let bindGroup = state.bindGroup;
          if (state.needsMedia && state.pipeline) {
            const frame = propsRef.current.mediaFrame ?? state.fallbackFrame;
            if (frame) {
              try {
                const external = gpu.importExternalTexture({ source: frame });
                bindGroup = gpu.createBindGroup({
                  layout: state.pipeline.getBindGroupLayout(0),
                  entries: [
                    { binding: 0, resource: { buffer: state.uniformBuffer } },
                    { binding: MEDIA_TEXTURE_BINDING, resource: external },
                    { binding: MEDIA_SAMPLER_BINDING, resource: state.mediaSampler },
                  ],
                });
              } catch (e) {
                // A closed frame (the ring buffer evicted it) is not fatal.
                if (!destroyed) console.warn('media import failed:', e);
              }
            }
          }

          const texture = context.getCurrentTexture();
          const encoder = gpu.createCommandEncoder({ label: 'viewport' });
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
          if (state.pipeline && bindGroup) {
            pass.setPipeline(state.pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);
          }
          pass.end();
          gpu.queue.submit([encoder.finish()]);

          // Scope readback is demand-driven: no GPU-to-CPU copy happens
          // while the scopes panel is closed.
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
      stateRef.current = null;
      device?.destroy();
    };
  }, []);

  // Compile each shader revision into a fresh pipeline. The old pipeline
  // stays active while compilation runs, so editing the graph does not blank
  // the viewport. This effect is what makes DAG changes visible at all.
  useEffect(() => {
    const state = stateRef.current;
    if (!deviceReady || !state) return;

    let cancelled = false;
    const source = shaderCode ?? COMPOSITE_SHADER;
    setStatus('compiling');

    (async () => {
      try {
        const module = state.device.createShaderModule({ code: source, label: 'viewport-shader' });
        const info = await module.getCompilationInfo();
        if (cancelled) return;

        const messages = info.messages.filter((m) => m.type === 'error');
        if (messages.length > 0) {
          setStatus('error');
          setErrorMsg(
            messages
              .slice(0, 6)
              .map((m) => `line ${m.lineNum}:${m.linePos} — ${m.message}`)
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
            fragment: {
              module,
              entryPoint: 'fs',
              targets: [{ format: state.format }],
            },
            primitive: { topology: 'triangle-list' },
          });
        } catch (e) {
          await state.device.popErrorScope();
          if (!cancelled) {
            setStatus('error');
            setErrorMsg(String(e));
          }
          return;
        }

        const validation = await state.device.popErrorScope();
        if (cancelled) return;
        if (validation) {
          setStatus('error');
          setErrorMsg(validation.message);
          return;
        }

        let bindGroup: GPUBindGroup;
        try {
          // A graph with a media source declares `media_tex`/`media_samp`; the
          // shader itself is the source of truth for whether they are needed.
          const needsMedia = source.includes('var media_tex');
          const entries: GPUBindGroupEntry[] = [
            { binding: 0, resource: { buffer: state.uniformBuffer } },
          ];
          if (needsMedia) {
            // The external texture itself is bound per frame, because an
            // imported external texture only lives for the current task.
            const external = state.device.importExternalTexture({
              source: state.fallbackFrame as VideoFrame,
            });
            entries.push({ binding: MEDIA_TEXTURE_BINDING, resource: external });
            entries.push({ binding: MEDIA_SAMPLER_BINDING, resource: state.mediaSampler });
          }
          bindGroup = state.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries,
          });
          state.needsMedia = needsMedia;
        } catch (e) {
          if (!cancelled) {
            setStatus('error');
            setErrorMsg(String(e));
          }
          return;
        }

        state.pipeline = pipeline;
        state.bindGroup = bindGroup;
        setStatus('ready');
        setErrorMsg('');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceReady, shaderCode]);

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
      {status === 'error' && (
        <div className="absolute inset-x-3 bottom-3 max-h-36 overflow-auto rounded-md border border-warning/40 bg-ink/95 p-3 font-mono text-[10px] leading-relaxed text-warning shadow-xl">
          <div className="mb-1 font-sans text-[11px] font-medium">GPU shader error</div>
          <pre className="whitespace-pre-wrap">{errorMsg}</pre>
        </div>
      )}
    </div>
  );
});
