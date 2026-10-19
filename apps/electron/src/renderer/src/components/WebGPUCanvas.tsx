/// <reference types="@webgpu/types" />
import { useEffect, useRef, useState } from 'react';

export function WebGPUCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'init' | 'ready' | 'error'>('init');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
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
        const device = await adapter.requestDevice();
        if (destroyed) return;

        const context = canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'premultiplied' });

        // WGSL shader: animated gradient + grid + vignette
        const shaderCode = `
          struct Uniforms {
            time: f32,
            resolution: vec2<f32>,
          };
          @group(0) @binding(0) var<uniform> u: Uniforms;

          @vertex
          fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 6>(
              vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
              vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0)
            );
            return vec4(pos[vi], 0.0, 1.0);
          }

          fn hash(p: vec2<f32>) -> f32 {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }

          @fragment
          fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let uv = fragCoord.xy / u.resolution;
            let t = u.time;

            // animated gradient
            let col = mix(
              vec3(0.04, 0.05, 0.08),
              vec3(0.12, 0.08, 0.18),
              uv.y + 0.3 * sin(t * 0.5 + uv.x * 3.0)
            );

            // moving grid
            let grid = (sin(uv.x * 40.0 + t) * 0.5 + 0.5) * (sin(uv.y * 40.0 - t * 0.7) * 0.5 + 0.5);
            col += vec3(0.02, 0.03, 0.05) * grid;

            // accent glow
            let d = distance(uv, vec2(0.5 + 0.1 * sin(t * 0.3), 0.5 + 0.1 * cos(t * 0.4)));
            col += vec3(1.0, 0.35, 0.17) * (0.08 / (d + 0.3));

            // vignette
            let v = 1.0 - smoothstep(0.4, 1.2, length(uv - 0.5) * 1.6);
            col *= v;

            return vec4(col, 1.0);
          }
        `;

        const shaderModule = device.createShaderModule({ code: shaderCode });
        const uniformBuffer = device.createBuffer({
          size: 16,
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

        let frameId = 0;
        const render = () => {
          if (destroyed) return;
          const t = performance.now() / 1000;
          device.queue.writeBuffer(
            uniformBuffer,
            0,
            new Float32Array([t, 0, canvas.width, canvas.height]),
          );
          const encoder = device.createCommandEncoder();
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
          device.queue.submit([encoder.finish()]);
          frameId = requestAnimationFrame(render);
        };

        const resize = () => {
          canvas.width = canvas.clientWidth * devicePixelRatio;
          canvas.height = canvas.clientHeight * devicePixelRatio;
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        setStatus('ready');
        render();

        return () => {
          destroyed = true;
          cancelAnimationFrame(frameId);
          ro.disconnect();
          device.destroy();
        };
      } catch (e) {
        if (!destroyed) {
          setStatus('error');
          setErrorMsg(String(e));
        }
      }
    })();
  }, []);

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
