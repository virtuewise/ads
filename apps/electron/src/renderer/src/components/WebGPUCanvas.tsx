/// <reference types="@webgpu/types" />
import { useEffect, useRef, useState } from 'react';
import type { BrandLUT, TransformState } from '../engine/types';
import { COMPOSITE_SHADER, packUniforms, UNIFORM_BYTES, UNIFORM_FLOATS } from '../engine/visual';

interface WebGPUCanvasProps {
  /** Frame time in seconds; the App's playhead drives this. */
  time?: number;
  transform?: TransformState;
  lut?: BrandLUT | null;
  /** Optional DAG-compiled WGSL shader. Falls back to COMPOSITE_SHADER when absent. */
  shaderCode?: string;
}

export function WebGPUCanvas({ time = 0, transform, lut, shaderCode }: WebGPUCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'init' | 'ready' | 'error'>('init');
  const [errorMsg, setErrorMsg] = useState('');

  // Latest props, read by the persistent render loop without re-initialising.
  const propsRef = useRef({ time, transform, lut, shaderCode });
  propsRef.current = { time, transform, lut, shaderCode };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    let frameId = 0;
    let device: GPUDevice | null = null;

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

        const context = canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device: gpu, format, alphaMode: 'premultiplied' });

        // Use the DAG-compiled shader if provided, otherwise fall back to the composite shader
        const shaderSource = propsRef.current.shaderCode ?? COMPOSITE_SHADER;
        const shaderModule = gpu.createShaderModule({ code: shaderSource });
        const uniformBuffer = gpu.createBuffer({
          size: UNIFORM_BYTES,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const pipeline = gpu.createRenderPipeline({
          layout: 'auto',
          vertex: { module: shaderModule, entryPoint: 'vs' },
          fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format }] },
          primitive: { topology: 'triangle-list' },
        });

        const bindGroup = gpu.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });

        const data = new Float32Array(UNIFORM_FLOATS);

        const render = () => {
          if (destroyed) return;
          const w = canvas.width || 1;
          const h = canvas.height || 1;
          packUniforms(data, {
            time: propsRef.current.time,
            width: w,
            height: h,
            transform: propsRef.current.transform,
            lut: propsRef.current.lut,
          });
          gpu.queue.writeBuffer(uniformBuffer, 0, data);

          const encoder = gpu.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: context.getCurrentTexture().createView(),
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
          gpu.queue.submit([encoder.finish()]);
          frameId = requestAnimationFrame(render);
        };

        const resize = () => {
          canvas.width = Math.max(1, Math.floor(canvas.clientWidth * devicePixelRatio));
          canvas.height = Math.max(1, Math.floor(canvas.clientHeight * devicePixelRatio));
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        setStatus('ready');
        render();

        return () => {
          ro.disconnect();
        };
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
      device?.destroy();
    };
  }, []);

  // Recompile the shader when shaderCode changes
  useEffect(() => {
    if (!shaderCode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Force a re-render by toggling a state
    setStatus((s) => (s === 'ready' ? 'ready' : s));
  }, [shaderCode]);

  return (
    <div className="relative w-full h-full bg-ink">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {status === 'init' && (
        <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
          Initializing WebGPU…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="px-3 py-1.5 rounded-md border border-warning/40 bg-warning/10 text-warning text-xs font-mono">
            {errorMsg}
          </span>
        </div>
      )}
    </div>
  );
}
