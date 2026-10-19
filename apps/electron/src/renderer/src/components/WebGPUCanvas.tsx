/// <reference types="@webgpu/types" />
import { useEffect, useRef, useState } from 'react';
import type { BrandLUT, TransformState } from '../engine/types';

interface WebGPUCanvasProps {
  /** Frame time in seconds; the App's playhead drives this. */
  time?: number;
  transform?: TransformState;
  lut?: BrandLUT | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full =
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m;
  const int = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(int)) return [0, 0, 0];
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

const SHADER = /* wgsl */ `
  struct Uniforms {
    time: f32,
    scale: f32,
    rotation: f32,
    opacity: f32,
    resolution: vec2<f32>,
    translation: vec2<f32>,
    lutShadow: vec4<f32>,
    lutMid: vec4<f32>,
    lutHighlight: vec4<f32>,
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

  @fragment
  fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var uv = fragCoord.xy / u.resolution;
    var c = uv - vec2(0.5, 0.5);
    let ca = cos(u.rotation);
    let sa = sin(u.rotation);
    c = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca);
    c = c / max(u.scale, 0.0001);
    c = c - u.translation;
    uv = c + vec2(0.5, 0.5);

    let t = u.time;
    var col = mix(
      vec3(0.04, 0.05, 0.08),
      vec3(0.12, 0.08, 0.18),
      uv.y + 0.3 * sin(t * 0.5 + uv.x * 3.0)
    );

    let grid = (sin(uv.x * 40.0 + t) * 0.5 + 0.5) * (sin(uv.y * 40.0 - t * 0.7) * 0.5 + 0.5);
    col += vec3(0.02, 0.03, 0.05) * grid;

    let d = distance(uv, vec2(0.5 + 0.1 * sin(t * 0.3), 0.5 + 0.1 * cos(t * 0.4)));
    col += vec3(1.0, 0.35, 0.17) * (0.08 / (d + 0.3));

    let v = 1.0 - smoothstep(0.4, 1.2, length(uv - vec2(0.5, 0.5)) * 1.6);
    col *= v;

    // Brand LUT: luminance-based tri-tone grade.
    let lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    var lutCol = mix(u.lutShadow.rgb, u.lutMid.rgb, smoothstep(0.0, 0.5, lum));
    lutCol = mix(lutCol, u.lutHighlight.rgb, smoothstep(0.5, 1.0, lum));
    col = mix(col, lutCol, u.lutShadow.a);

    let a = clamp(u.opacity, 0.0, 1.0);
    return vec4(col * a, a);
  }
`;

export function WebGPUCanvas({ time = 0, transform, lut }: WebGPUCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'init' | 'ready' | 'error'>('init');
  const [errorMsg, setErrorMsg] = useState('');

  // Latest props, read by the persistent render loop without re-initialising.
  const propsRef = useRef({ time, transform, lut });
  propsRef.current = { time, transform, lut };

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

        const shaderModule = gpu.createShaderModule({ code: SHADER });
        const uniformBuffer = gpu.createBuffer({
          size: 80,
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

        const data = new Float32Array(20);

        const render = () => {
          if (destroyed) return;
          const { time: t, transform: tr, lut: l } = propsRef.current;
          const w = canvas.width || 1;
          const h = canvas.height || 1;
          data[0] = t;
          data[1] = tr?.scale ?? 1;
          data[2] = ((tr?.rotation ?? 0) * Math.PI) / 180;
          data[3] = tr?.opacity ?? 1;
          data[4] = w;
          data[5] = h;
          data[6] = (tr?.x ?? 0) / w;
          data[7] = (tr?.y ?? 0) / h;
          const shadow = l && l.id !== 'none' ? hexToRgb(l.colors.shadow) : [0, 0, 0];
          const mid = l && l.id !== 'none' ? hexToRgb(l.colors.midtone) : [0.5, 0.5, 0.5];
          const high = l && l.id !== 'none' ? hexToRgb(l.colors.highlight) : [1, 1, 1];
          const intensity = l ? l.intensity : 0;
          data[8] = shadow[0];
          data[9] = shadow[1];
          data[10] = shadow[2];
          data[11] = intensity;
          data[12] = mid[0];
          data[13] = mid[1];
          data[14] = mid[2];
          data[15] = 0;
          data[16] = high[0];
          data[17] = high[1];
          data[18] = high[2];
          data[19] = 0;

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
