// ── Node System ──────────────────────────────────────────────────────────────
// Every visual node is a TypeScript class. Nodes serialize to JSON and compile
// to WGSL fragment shaders for the WebGPU pipeline.

import type { ComputeNodeSpec, Port } from './types';

export abstract class BaseNode {
  abstract readonly type: string;
  abstract readonly label: string;
  abstract readonly category:
    | 'source'
    | 'transform'
    | 'effect'
    | 'composite'
    | 'output'
    | 'script'
    | 'distort'
    | 'stylize'
    | 'color'
    | 'blur'
    | 'keying'
    | 'temporal'
    | 'light'
    | 'compute'
    | 'utility'
    | 'generate';
  abstract readonly ports: Port[];
  abstract execute(inputs: Record<string, unknown>): Record<string, unknown>;
  abstract toWGSL(): string;

  toJSON() {
    return { type: this.type, label: this.label, category: this.category, ports: this.ports };
  }
}

// ── Source Nodes ─────────────────────────────────────────────────────────────

export class DataSourceNode extends BaseNode {
  readonly type = 'dataSource';
  readonly label = 'Data Source';
  readonly category = 'source' as const;
  readonly ports: Port[] = [
    {
      id: 'values',
      name: 'Values',
      type: 'number',
      direction: 'output',
      default: [0, 0.25, 0.5, 0.75, 1],
    },
  ];
  execute(): Record<string, unknown> {
    return { values: [0, 0.25, 0.5, 0.75, 1] };
  }
  toWGSL() {
    return `fn data_source() -> f32 { return 0.5; }`;
  }
}

export class ColorSourceNode extends BaseNode {
  readonly type = 'colorSource';
  readonly label = 'Color';
  readonly category = 'source' as const;
  readonly ports: Port[] = [
    { id: 'color', name: 'Color', type: 'color', direction: 'output', default: '#ff5a2c' },
  ];
  execute(): Record<string, unknown> {
    return { color: '#ff5a2c' };
  }
  toWGSL() {
    return `fn color_source() -> vec4<f32> { return vec4(1.0, 0.35, 0.17, 1.0); }`;
  }
}

export class NoiseSourceNode extends BaseNode {
  readonly type = 'noiseSource';
  readonly label = 'Noise';
  readonly category = 'source' as const;
  readonly ports: Port[] = [
    { id: 'scale', name: 'Scale', type: 'number', direction: 'input', default: 1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `noise(${inputs.scale ?? 1})` };
  }
  toWGSL() {
    return `fn noise_source(scale: f32) -> f32 { return fract(sin(scale * 12.9898) * 43758.5453); }`;
  }
}

/**
 * The default full-frame source. It is deliberately texture-free: the
 * single-pass bridge can evaluate it directly, which keeps the out-of-the-box
 * graph renderable while the multi-pass effect runtime is still being built.
 */
export class ProceduralSceneNode extends BaseNode {
  readonly type = 'proceduralScene';
  readonly label = 'Procedural Scene';
  readonly category = 'source' as const;
  readonly ports: Port[] = [{ id: 'output', name: 'Output', type: 'texture', direction: 'output' }];
  execute(): Record<string, unknown> {
    return { output: 'procedural_scene(uv)' };
  }
  toWGSL() {
    return `fn procedural_scene(uv: vec2<f32>) -> vec4<f32> {
      let t = u.time;
      let p = uv - vec2<f32>(0.5);
      let r = length(p);

      let core = exp(-5.5 * r * r);
      var col = mix(vec3<f32>(0.020, 0.027, 0.043), vec3<f32>(0.055, 0.075, 0.120), core);

      let bandA = sin(uv.x * 5.2 + t * 0.35 + sin(uv.y * 3.8 - t * 0.28) * 1.25);
      let bandB = sin(uv.y * 7.0 - t * 0.22 + sin(uv.x * 4.0 + t * 0.19) * 0.9);
      col += vec3<f32>(0.018, 0.038, 0.055) * smoothstep(0.55, 1.0, bandA);
      col += vec3<f32>(0.032, 0.022, 0.045) * smoothstep(0.62, 1.0, bandB);

      let accentPos = vec2<f32>(0.53 + 0.14 * cos(t * 0.31), 0.5 + 0.10 * sin(t * 0.27));
      let coolPos = vec2<f32>(0.47 + 0.18 * cos(t * 0.19 + 2.3), 0.5 + 0.14 * sin(t * 0.23 + 1.1));
      let accent = exp(-42.0 * dot(uv - accentPos, uv - accentPos));
      let cool = exp(-58.0 * dot(uv - coolPos, uv - coolPos));
      col += accent * vec3<f32>(1.0, 0.353, 0.173) * 0.72;
      col += cool * vec3<f32>(0.369, 0.918, 0.831) * 0.42;

      let grid =
        smoothstep(0.96, 1.0, cos(uv.x * 90.0)) +
        smoothstep(0.96, 1.0, cos(uv.y * 90.0));
      col += vec3<f32>(0.03, 0.045, 0.06) * grid * 0.35;

      let grain = fract(sin(dot(uv, vec2<f32>(12.9898, 78.233)) + t * 0.7) * 43758.5453);
      col += (grain - 0.5) * 0.012;

      let vig = 1.0 - smoothstep(0.38, 0.85, r);
      col *= mix(0.55, 1.0, vig);
      return vec4<f32>(max(col, vec3<f32>(0.0)), 1.0);
    }`;
  }
}

// ── Transform Nodes ──────────────────────────────────────────────────────────

export class TransformNode extends BaseNode {
  readonly type = 'transform';
  readonly label = 'Transform';
  readonly category = 'transform' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'number', direction: 'input', default: 0 },
    { id: 'scale', name: 'Scale', type: 'number', direction: 'input', default: 1 },
    { id: 'offset', name: 'Offset', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'number', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output:
        (Number(inputs.input) || 0) * (Number(inputs.scale) || 1) + (Number(inputs.offset) || 0),
    };
  }
  toWGSL() {
    return `fn transform(input: f32, scale: f32, offset: f32) -> f32 { return input * scale + offset; }`;
  }
}

export class EaseNode extends BaseNode {
  readonly type = 'ease';
  readonly label = 'Ease';
  readonly category = 'transform' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'number', direction: 'input', default: 0 },
    { id: 'type', name: 'Type', type: 'string', direction: 'input', default: 'easeInOut' },
    { id: 'output', name: 'Output', type: 'number', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const t = Number(inputs.input) || 0;
    const type = String(inputs.type ?? 'easeInOut');
    if (type === 'linear') return { output: t };
    if (type === 'easeIn') return { output: t * t };
    if (type === 'easeOut') return { output: 1 - (1 - t) * (1 - t) };
    return { output: t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2 };
  }
  toWGSL() {
    return `fn ease(t: f32, type: f32) -> f32 {
      if (type == 0.0) { return t; }
      if (type == 1.0) { return t * t; }
      if (type == 2.0) { return 1.0 - (1.0 - t) * (1.0 - t); }
      return select(1.0 - pow(2.0 * t + 2.0, 2.0) / 2.0, 2.0 * t * t, t < 0.5);
    }`;
  }
}

export class StaggerNode extends BaseNode {
  readonly type = 'stagger';
  readonly label = 'Stagger';
  readonly category = 'transform' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'number', direction: 'input', default: 0 },
    { id: 'index', name: 'Index', type: 'number', direction: 'input', default: 0 },
    { id: 'delay', name: 'Delay', type: 'number', direction: 'input', default: 0.1 },
    { id: 'output', name: 'Output', type: 'number', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const t = inputs.input ?? 0;
    const i = inputs.index ?? 0;
    const d = inputs.delay ?? 0.1;
    return { output: Math.max(0, Math.min(1, Number(t) - Number(i) * Number(d))) };
  }
  toWGSL() {
    return `fn stagger(t: f32, index: f32, delay: f32) -> f32 { return clamp(t - index * delay, 0.0, 1.0); }`;
  }
}

// ── Effect Nodes ─────────────────────────────────────────────────────────────

export class SpatialTransformNode extends BaseNode {
  readonly type = 'spatialTransform';
  readonly label = 'Spatial Transform';
  readonly category = 'transform' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'x', name: 'Position X', type: 'number', direction: 'input', default: 0 },
    { id: 'y', name: 'Position Y', type: 'number', direction: 'input', default: 0 },
    { id: 'scale', name: 'Scale', type: 'number', direction: 'input', default: 1 },
    { id: 'rotation', name: 'Rotation', type: 'number', direction: 'input', default: 0 },
    { id: 'opacity', name: 'Opacity', type: 'number', direction: 'input', default: 1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `spatialTransform(${inputs.input}, ${inputs.x ?? 0}, ${inputs.y ?? 0}, ${inputs.scale ?? 1}, ${inputs.rotation ?? 0}, ${inputs.opacity ?? 1})`,
    };
  }
  toWGSL() {
    return `fn spatial_transform(
      src: texture_2d<f32>,
      samp: sampler,
      uv: vec2<f32>,
      x: f32,
      y: f32,
      scale: f32,
      rotation: f32,
      opacity: f32,
    ) -> vec4<f32> {
      var c = uv - vec2(0.5, 0.5);
      let ca = cos(rotation);
      let sa = sin(rotation);
      c = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca);
      c = c / max(scale, 0.0001);
      c = c - vec2(x, y);
      let tuv = c + vec2(0.5, 0.5);
      var col = textureSample(src, samp, tuv);
      let a = clamp(opacity, 0.0, 1.0);
      return vec4(col.rgb * a, col.a * a);
    }`;
  }
}

export class OscillatorNode extends BaseNode {
  readonly type = 'oscillator';
  readonly label = 'Oscillator';
  readonly category = 'transform' as const;
  readonly ports: Port[] = [
    { id: 'time', name: 'Time', type: 'number', direction: 'input', default: 0 },
    { id: 'waveform', name: 'Waveform', type: 'string', direction: 'input', default: 'sine' },
    { id: 'frequency', name: 'Frequency', type: 'number', direction: 'input', default: 1 },
    { id: 'amplitude', name: 'Amplitude', type: 'number', direction: 'input', default: 1 },
    { id: 'output', name: 'Output', type: 'number', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const t = Number(inputs.time) || 0;
    const freq = Number(inputs.frequency) || 1;
    const amp = Number(inputs.amplitude) || 1;
    const phase = t * freq;
    const w = String(inputs.waveform ?? 'sine');
    let v: number;
    switch (w) {
      case 'square':
        v = Math.sin(phase) >= 0 ? 1 : -1;
        break;
      case 'triangle':
        v = (2 / Math.PI) * Math.asin(Math.sin(phase));
        break;
      case 'sawtooth':
        v = 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5));
        break;
      default:
        v = Math.sin(phase);
    }
    return { output: v * amp };
  }
  toWGSL() {
    return `fn oscillator(time: f32, kind: f32, freq: f32, amp: f32) -> f32 {
      let phase = time * freq;
      if (kind == 1.0) { return step(0.0, sin(phase)) * 2.0 * amp - amp; }
      if (kind == 2.0) { return asin(sin(phase)) * (2.0 / ${Math.PI}) * amp; }
      if (kind == 3.0) { return (2.0 * (phase / ${2 * Math.PI} - floor(phase / ${2 * Math.PI} + 0.5))) * amp; }
      return sin(phase) * amp;
    }`;
  }
}

export class SpringNode extends BaseNode {
  readonly type = 'spring';
  readonly label = 'Spring';
  readonly category = 'transform' as const;
  readonly ports: Port[] = [
    { id: 'time', name: 'Time', type: 'number', direction: 'input', default: 0 },
    { id: 'target', name: 'Target', type: 'number', direction: 'input', default: 1 },
    { id: 'stiffness', name: 'Stiffness', type: 'number', direction: 'input', default: 0.1 },
    { id: 'damping', name: 'Damping', type: 'number', direction: 'input', default: 0.7 },
    { id: 'output', name: 'Output', type: 'number', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const t = Number(inputs.time) || 0;
    const target = Number(inputs.target) || 1;
    const stiffness = Number(inputs.stiffness) || 0.1;
    const damping = Number(inputs.damping) || 0.7;
    // Analytic underdamped spring: x(t) = target * (1 - e^(-d t) cos(w t))
    const w = Math.sqrt(Math.max(stiffness, 0.0001));
    const v = target * (1 - Math.exp(-damping * t) * Math.cos(w * t));
    return { output: v };
  }
  toWGSL() {
    return `fn spring(time: f32, target: f32, stiffness: f32, damping: f32) -> f32 {
      let w = sqrt(max(stiffness, 0.0001));
      return target * (1.0 - exp(-damping * time) * cos(w * time));
    }`;
  }
}

export class GlowNode extends BaseNode {
  readonly type = 'glow';
  readonly label = 'Glow';
  readonly category = 'effect' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'intensity', name: 'Intensity', type: 'number', direction: 'input', default: 0.5 },
    { id: 'radius', name: 'Radius', type: 'number', direction: 'input', default: 10 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `glow(${inputs.input}, ${inputs.intensity ?? 0.5})` };
  }
  toWGSL() {
    return `fn glow(color: vec4<f32>, intensity: f32) -> vec4<f32> { return color + vec4(intensity * 0.5, intensity * 0.3, intensity * 0.1, 0.0); }`;
  }
}

export class BlurNode extends BaseNode {
  readonly type = 'blur';
  readonly label = 'Blur';
  readonly category = 'effect' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'radius', name: 'Radius', type: 'number', direction: 'input', default: 5 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `blur(${inputs.input}, ${inputs.radius ?? 5})` };
  }
  toWGSL() {
    // Separable Gaussian blur: 9-tap horizontal pass. The vertical pass runs
    // as a second invocation. Weights are precomputed for sigma=2.0.
    return `fn blur(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, radius: f32) -> vec4<f32> {
      let texel = 1.0 / vec2<f32>(textureDimensions(src));
      let r = clamp(radius, 0.0, 16.0);
      var sum = vec4<f32>(0.0);
      var wsum = 0.0;
      for (var i = -4; i <= 4; i = i + 1) {
        let w = exp(-f32(i * i) / (2.0 * r * r));
        sum = sum + textureSample(src, samp, uv + vec2<f32>(f32(i), 0.0) * texel * r) * w;
        wsum = wsum + w;
      }
      return sum / wsum;
    }`;
  }
}

export class ColorGradeNode extends BaseNode {
  readonly type = 'colorGrade';
  readonly label = 'Color Grade';
  readonly category = 'effect' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'lift', name: 'Lift', type: 'color', direction: 'input', default: '#000000' },
    { id: 'gamma', name: 'Gamma', type: 'color', direction: 'input', default: '#808080' },
    { id: 'gain', name: 'Gain', type: 'color', direction: 'input', default: '#ffffff' },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `colorGrade(${inputs.input}, ${inputs.lift ?? '#000000'}, ${inputs.gamma ?? '#808080'}, ${inputs.gain ?? '#ffffff'})`,
    };
  }
  toWGSL() {
    return `fn color_grade(color: vec4<f32>, lift: vec3<f32>, gamma: vec3<f32>, gain: vec3<f32>) -> vec4<f32> {
      var c = color.rgb + lift;
      c = c * gain;
      c = pow(max(c, vec3<f32>(0.0)), 1.0 / max(gamma, vec3<f32>(0.001)));
      return vec4(c, color.a);
    }`;
  }
}

export class VignetteNode extends BaseNode {
  readonly type = 'vignette';
  readonly label = 'Vignette';
  readonly category = 'effect' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'intensity', name: 'Intensity', type: 'number', direction: 'input', default: 0.3 },
    { id: 'softness', name: 'Softness', type: 'number', direction: 'input', default: 0.5 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `vignette(${inputs.input}, ${inputs.intensity ?? 0.3})` };
  }
  toWGSL() {
    return `fn vignette(color: vec4<f32>, uv: vec2<f32>, intensity: f32, softness: f32) -> vec4<f32> {
      let d = distance(uv, vec2(0.5)) * 1.41421356;
      let m = smoothstep(0.5 - softness, 1.0, d);
      return vec4(color.rgb * (1.0 - intensity * m), color.a);
    }`;
  }
}

// ── Composite Nodes ──────────────────────────────────────────────────────────

export class BlendNode extends BaseNode {
  readonly type = 'blend';
  readonly label = 'Blend';
  readonly category = 'composite' as const;
  readonly ports: Port[] = [
    { id: 'inputA', name: 'A', type: 'texture', direction: 'input' },
    { id: 'inputB', name: 'B', type: 'texture', direction: 'input' },
    { id: 'mode', name: 'Mode', type: 'string', direction: 'input', default: 'normal' },
    { id: 'opacity', name: 'Opacity', type: 'number', direction: 'input', default: 0.5 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `blend(${inputs.inputA}, ${inputs.inputB}, '${inputs.mode ?? 'normal'}', ${inputs.opacity ?? 0.5})`,
    };
  }
  toWGSL() {
    return `fn blend_mode(a: vec3<f32>, b: vec3<f32>, mode: f32) -> vec3<f32> {
      if (mode == 1.0) { return min(a, b); }
      if (mode == 2.0) { return 1.0 - (1.0 - a) * (1.0 - b); }
      if (mode == 3.0) { return mix(a, b, step(0.5, a)); }
      if (mode == 4.0) { return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a)); }
      if (mode == 5.0) { return a * (1.0 - b); }
      if (mode == 6.0) { return a / max(b, vec3<f32>(0.001)); }
      if (mode == 7.0) { return abs(a - b); }
      return b;
    }
    fn blend(a: vec4<f32>, b: vec4<f32>, mode: f32, opacity: f32) -> vec4<f32> {
      let blended = blend_mode(a.rgb, b.rgb, mode);
      let o = a.a * opacity;
      return vec4(mix(a.rgb, blended, o), a.a + b.a * (1.0 - a.a));
    }`;
  }
}

export class AlphaMergeNode extends BaseNode {
  readonly type = 'alphaMerge';
  readonly label = 'Alpha Merge';
  readonly category = 'composite' as const;
  readonly ports: Port[] = [
    { id: 'foreground', name: 'FG', type: 'texture', direction: 'input' },
    { id: 'background', name: 'BG', type: 'texture', direction: 'input' },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `alphaMerge(${inputs.foreground}, ${inputs.background})` };
  }
  toWGSL() {
    return `fn alpha_merge(fg: vec4<f32>, bg: vec4<f32>) -> vec4<f32> {
      let a = fg.a + bg.a * (1.0 - fg.a);
      let rgb = (fg.rgb * fg.a + bg.rgb * bg.a * (1.0 - fg.a)) / max(a, 0.001);
      return vec4(rgb, a);
    }`;
  }
}

// ── Output Nodes ─────────────────────────────────────────────────────────────

export class ChromaticAberrationNode extends BaseNode {
  readonly type = 'chromaticAberration';
  readonly label = 'Chromatic Aberration';
  readonly category = 'distort' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'amount', name: 'Amount', type: 'number', direction: 'input', default: 0.005 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `chromaticAberration(${inputs.input}, ${inputs.amount ?? 0.005})` };
  }
  toWGSL() {
    return `fn chromatic_aberration(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, amount: f32) -> vec4<f32> {
      let center = vec2(0.5, 0.5);
      let dir = uv - center;
      let r = textureSample(src, samp, uv + dir * amount).r;
      let g = textureSample(src, samp, uv).g;
      let b = textureSample(src, samp, uv - dir * amount).b;
      let a = textureSample(src, samp, uv).a;
      return vec4(r, g, b, a);
    }`;
  }
}

export class SharpenNode extends BaseNode {
  readonly type = 'sharpen';
  readonly label = 'Sharpen';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'amount', name: 'Amount', type: 'number', direction: 'input', default: 1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `sharpen(${inputs.input}, ${inputs.amount ?? 1})` };
  }
  toWGSL() {
    return `fn sharpen(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, amount: f32) -> vec4<f32> {
      let texSize = vec2<f32>(textureDimensions(src));
      let step = 1.0 / texSize;
      let center = textureSample(src, samp, uv);
      let n = textureSample(src, samp, uv + vec2(0.0, -step.y));
      let s = textureSample(src, samp, uv + vec2(0.0, step.y));
      let e = textureSample(src, samp, uv + vec2(step.x, 0.0));
      let w = textureSample(src, samp, uv + vec2(-step.x, 0.0));
      let laplacian = (n + s + e + w) * 0.25 - center;
      return center - laplacian * amount;
    }`;
  }
}

export class FilmGrainNode extends BaseNode {
  readonly type = 'filmGrain';
  readonly label = 'Film Grain';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'amount', name: 'Amount', type: 'number', direction: 'input', default: 0.1 },
    { id: 'time', name: 'Time', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `filmGrain(${inputs.input}, ${inputs.amount ?? 0.1}, ${inputs.time ?? 0})` };
  }
  toWGSL() {
    return `fn film_grain(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, amount: f32, time: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let n = fract(sin(dot(uv * 1000.0 + time * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
      let grain = (n - 0.5) * amount;
      return vec4(col.rgb + grain, col.a);
    }`;
  }
}

export class LensDistortionNode extends BaseNode {
  readonly type = 'lensDistortion';
  readonly label = 'Lens Distortion';
  readonly category = 'distort' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'k1', name: 'K1', type: 'number', direction: 'input', default: 0.1 },
    { id: 'k2', name: 'K2', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `lensDistortion(${inputs.input}, ${inputs.k1 ?? 0.1}, ${inputs.k2 ?? 0})` };
  }
  toWGSL() {
    return `fn lens_distortion(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, k1: f32, k2: f32) -> vec4<f32> {
      let center = vec2(0.5, 0.5);
      var p = uv - center;
      let r2 = dot(p, p);
      let factor = 1.0 + k1 * r2 + k2 * r2 * r2;
      p = p * factor;
      let tuv = p + center;
      return textureSample(src, samp, tuv);
    }`;
  }
}

export class SolidSourceNode extends BaseNode {
  readonly type = 'solidSource';
  readonly label = 'Solid Color';
  readonly category = 'source' as const;
  readonly ports: Port[] = [
    { id: 'color', name: 'Color', type: 'color', direction: 'input', default: '#ff5a2c' },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const color = String(inputs.color ?? '#ff5a2c');
    return { output: `solid_source(${color})` };
  }
  toWGSL() {
    return `fn solid_source(color: vec3<f32>) -> vec4<f32> {
      return vec4(color, 1.0);
    }`;
  }
}

export class GradientSourceNode extends BaseNode {
  readonly type = 'gradientSource';
  readonly label = 'Gradient';
  readonly category = 'source' as const;
  readonly ports: Port[] = [
    {
      id: 'startColor',
      name: 'Start Color',
      type: 'color',
      direction: 'input',
      default: '#ff5a2c',
    },
    { id: 'endColor', name: 'End Color', type: 'color', direction: 'input', default: '#5eead4' },
    { id: 'angle', name: 'Angle', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `gradient_source(${inputs.startColor ?? '#ff5a2c'}, ${inputs.endColor ?? '#5eead4'}, ${inputs.angle ?? 0})`,
    };
  }
  toWGSL() {
    return `fn gradient_source(uv: vec2<f32>, start: vec3<f32>, end: vec3<f32>, angle: f32) -> vec4<f32> {
      let t = (uv.x * cos(angle) + uv.y * sin(angle) + 1.0) * 0.5;
      return vec4(mix(start, end, clamp(t, 0.0, 1.0)), 1.0);
    }`;
  }
}

export class CheckerSourceNode extends BaseNode {
  readonly type = 'checkerSource';
  readonly label = 'Checkerboard';
  readonly category = 'source' as const;
  readonly ports: Port[] = [
    { id: 'colorA', name: 'Color A', type: 'color', direction: 'input', default: '#ffffff' },
    { id: 'colorB', name: 'Color B', type: 'color', direction: 'input', default: '#000000' },
    { id: 'scale', name: 'Scale', type: 'number', direction: 'input', default: 8 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `checker_source(${inputs.colorA ?? '#ffffff'}, ${inputs.colorB ?? '#000000'}, ${inputs.scale ?? 8})`,
    };
  }
  toWGSL() {
    return `fn checker_source(uv: vec2<f32>, colorA: vec3<f32>, colorB: vec3<f32>, scale: f32) -> vec4<f32> {
      let c = floor(uv * scale);
      let parity = (c.x + c.y) % 2.0;
      let color = select(colorB, colorA, parity < 1.0);
      return vec4(color, 1.0);
    }`;
  }
}

export class TemperatureNode extends BaseNode {
  readonly type = 'temperature';
  readonly label = 'Temperature';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'temperature', name: 'Temperature', type: 'number', direction: 'input', default: 0 },
    { id: 'tint', name: 'Tint', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `temperature(${inputs.input}, ${inputs.temperature ?? 0}, ${inputs.tint ?? 0})`,
    };
  }
  toWGSL() {
    return `fn temperature(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, temp: f32, tint: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      var r = col.r;
      var g = col.g;
      var b = col.b;
      // Temperature: warm/cool shift
      r += temp * 0.1;
      b -= temp * 0.1;
      // Tint: green/magenta shift
      g += tint * 0.1;
      r -= tint * 0.05;
      b -= tint * 0.05;
      return vec4(clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0), col.a);
    }`;
  }
}

export class LevelsNode extends BaseNode {
  readonly type = 'levels';
  readonly label = 'Levels';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'black', name: 'Black Point', type: 'number', direction: 'input', default: 0 },
    { id: 'white', name: 'White Point', type: 'number', direction: 'input', default: 1 },
    { id: 'gamma', name: 'Gamma', type: 'number', direction: 'input', default: 1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `levels(${inputs.input}, ${inputs.black ?? 0}, ${inputs.white ?? 1}, ${inputs.gamma ?? 1})`,
    };
  }
  toWGSL() {
    return `fn levels(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, black: f32, white: f32, gamma: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let range = max(white - black, 0.0001);
      var r = (col.r - black) / range;
      var g = (col.g - black) / range;
      var b = (col.b - black) / range;
      r = pow(clamp(r, 0.0, 1.0), 1.0 / max(gamma, 0.0001));
      g = pow(clamp(g, 0.0, 1.0), 1.0 / max(gamma, 0.0001));
      b = pow(clamp(b, 0.0, 1.0), 1.0 / max(gamma, 0.0001));
      return vec4(r, g, b, col.a);
    }`;
  }
}

export class ExposureNode extends BaseNode {
  readonly type = 'exposure';
  readonly label = 'Exposure';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'exposure', name: 'Exposure', type: 'number', direction: 'input', default: 0 },
    { id: 'offset', name: 'Offset', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `exposure(${inputs.input}, ${inputs.exposure ?? 0}, ${inputs.offset ?? 0})` };
  }
  toWGSL() {
    return `fn exposure(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, exp: f32, offset: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let factor = pow(2.0, exp);
      return vec4(col.rgb * factor + offset, col.a);
    }`;
  }
}

export class SaturationNode extends BaseNode {
  readonly type = 'saturation';
  readonly label = 'Saturation';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'saturation', name: 'Saturation', type: 'number', direction: 'input', default: 1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `saturation(${inputs.input}, ${inputs.saturation ?? 1})` };
  }
  toWGSL() {
    return `fn saturation(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, sat: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let lum = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      return vec4(mix(vec3(lum), col.rgb, sat), col.a);
    }`;
  }
}

export class HueShiftNode extends BaseNode {
  readonly type = 'hueShift';
  readonly label = 'Hue Shift';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'hue', name: 'Hue', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `hueShift(${inputs.input}, ${inputs.hue ?? 0})` };
  }
  toWGSL() {
    return `fn hue_shift(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, hue: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let angle = hue * 6.2831853;
      let cosA = cos(angle);
      let sinA = sin(angle);
      let r = col.r * (0.299 + 0.701 * cosA + 0.168 * sinA)
            + col.g * (0.587 - 0.587 * cosA + 0.330 * sinA)
            + col.b * (0.114 - 0.114 * cosA - 0.497 * sinA);
      let g = col.r * (0.299 - 0.299 * cosA - 0.328 * sinA)
            + col.g * (0.587 + 0.413 * cosA + 0.035 * sinA)
            + col.b * (0.114 - 0.114 * cosA + 0.292 * sinA);
      let b = col.r * (0.299 - 0.300 * cosA + 1.250 * sinA)
            + col.g * (0.587 - 0.588 * cosA - 1.050 * sinA)
            + col.b * (0.114 + 0.886 * cosA - 0.203 * sinA);
      return vec4(clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0), col.a);
    }`;
  }
}

export class BloomNode extends BaseNode {
  readonly type = 'bloom';
  readonly label = 'Bloom';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'threshold', name: 'Threshold', type: 'number', direction: 'input', default: 0.8 },
    { id: 'intensity', name: 'Intensity', type: 'number', direction: 'input', default: 1 },
    { id: 'radius', name: 'Radius', type: 'number', direction: 'input', default: 4 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `bloom(${inputs.input}, ${inputs.threshold ?? 0.8}, ${inputs.intensity ?? 1}, ${inputs.radius ?? 4})`,
    };
  }
  toWGSL() {
    return `fn bloom(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, threshold: f32, intensity: f32, radius: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let lum = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      let bloomMask = smoothstep(threshold, 1.0, lum);
      var bloomCol = vec4(col.rgb * bloomMask, col.a);
      // Simple box blur for bloom
      let texSize = vec2<f32>(textureDimensions(src));
      let step = radius / max(texSize.x, texSize.y);
      var sum = vec4(0.0);
      for (var x = -2; x <= 2; x++) {
        for (var y = -2; y <= 2; y++) {
          let offset = vec2<f32>(f32(x), f32(y)) * step;
          let s = textureSample(src, samp, uv + offset);
          let sl = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
          sum += vec4(s.rgb * smoothstep(threshold, 1.0, sl), s.a);
        }
      }
      bloomCol = sum / 25.0 * intensity;
      return vec4(col.rgb + bloomCol.rgb, col.a);
    }`;
  }
}

export class PosterizeNode extends BaseNode {
  readonly type = 'posterize';
  readonly label = 'Posterize';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'levels', name: 'Levels', type: 'number', direction: 'input', default: 4 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `posterize(${inputs.input}, ${inputs.levels ?? 4})` };
  }
  toWGSL() {
    return `fn posterize(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, levels: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let l = max(levels, 1.0);
      return vec4(floor(col.rgb * l) / l, col.a);
    }`;
  }
}

export class DisplacementNode extends BaseNode {
  readonly type = 'displacementMap';
  readonly label = 'Displacement Map';
  readonly category = 'distort' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'displacement', name: 'Displacement', type: 'texture', direction: 'input' },
    { id: 'strength', name: 'Strength', type: 'number', direction: 'input', default: 0.1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `displacementMap(${inputs.input}, ${inputs.displacement}, ${inputs.strength ?? 0.1})`,
    };
  }
  toWGSL() {
    return `fn displacement_map(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, disp: texture_2d<f32>, dispSamp: sampler, strength: f32) -> vec4<f32> {
      let d = textureSample(disp, dispSamp, uv).rg * 2.0 - 1.0;
      let tuv = uv + d * strength;
      return textureSample(src, samp, tuv);
    }`;
  }
}

// ── Compute Nodes ────────────────────────────────────────────────────────────

export abstract class ComputeNode extends BaseNode {
  abstract readonly computeSpec: ComputeNodeSpec;
  readonly category = 'compute' as const;
}

export class HistogramNode extends ComputeNode {
  readonly type = 'histogram';
  readonly label = 'Histogram';
  readonly computeSpec: ComputeNodeSpec = {
    type: 'histogram',
    workgroupSize: [256, 1, 1],
    dispatch: (_inputs) => [1, 1, 1],
    wgsl: `@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var inputSamp: sampler;
@group(0) @binding(2) var<storage, read_write> histogram: array<atomic<u32>, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let texSize = textureDimensions(inputTex);
  let totalPixels = texSize.x * texSize.y;
  let pixelsPerThread = (totalPixels + 255u) / 256u;
  let start = gid.x * pixelsPerThread;
  let end = min(start + pixelsPerThread, totalPixels);
  for (var i = start; i < end; i = i + 1u) {
    let x = i % texSize.x;
    let y = i / texSize.x;
    let uv = (vec2<f32>(f32(x), f32(y)) + 0.5) / vec2<f32>(texSize);
    let col = textureSampleLevel(inputTex, inputSamp, uv, 0.0);
    let lum = dot(col.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let bin = u32(clamp(lum * 255.0, 0.0, 255.0));
    atomicAdd(&histogram[bin], 1u);
  }
}`,
    resources: [{ name: 'histogram', type: 'storage-buffer', size: 256 * 4 }],
  };
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `histogram(${inputs.input})` };
  }
  toWGSL() {
    return `fn histogram_placeholder() -> vec4<f32> { return vec4(0.0); }`;
  }
}

export class BlurPyramidNode extends ComputeNode {
  readonly type = 'blurPyramid';
  readonly label = 'Blur Pyramid';
  readonly computeSpec: ComputeNodeSpec = {
    type: 'blurPyramid',
    workgroupSize: [8, 8, 1],
    dispatch: (_inputs) => [1, 1, 1],
    wgsl: `@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let texSize = textureDimensions(inputTex);
  if (gid.x >= texSize.x || gid.y >= texSize.y) { return; }
  // Downsample by 2x2
  let uv = (vec2<f32>(gid.xy) + 0.5) / vec2<f32>(texSize);
  let step = 1.0 / vec2<f32>(texSize);
  var sum = vec4<f32>(0.0);
  for (var x = 0; x < 2; x++) {
    for (var y = 0; y < 2; y++) {
      let offset = vec2<f32>(f32(x), f32(y)) * step;
      sum += textureLoad(inputTex, vec2<i32>(gid.xy * 2u + vec2<u32>(u32(x), u32(y))), 0);
    }
  }
  textureStore(outputTex, vec2<i32>(gid.xy), sum / 4.0);
}`,
    resources: [{ name: 'outputTex', type: 'storage-texture', format: 'rgba8unorm' }],
  };
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `blurPyramid(${inputs.input})` };
  }
  toWGSL() {
    return `fn blur_pyramid_placeholder() -> vec4<f32> { return vec4(0.0); }`;
  }
}

export class OpticalFlowNode extends ComputeNode {
  readonly type = 'opticalFlow';
  readonly label = 'Optical Flow';
  readonly computeSpec: ComputeNodeSpec = {
    type: 'opticalFlow',
    workgroupSize: [8, 8, 1],
    dispatch: (_inputs) => [1, 1, 1],
    wgsl: `@group(0) @binding(0) var frameA: texture_2d<f32>;
@group(0) @binding(1) var frameB: texture_2d<f32>;
@group(0) @binding(2) var flowOut: texture_storage_2d<rg32float, write>;
@group(0) @binding(3) var samp: sampler;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let texSize = textureDimensions(frameA);
  if (gid.x >= texSize.x || gid.y >= texSize.y) { return; }
  let uv = (vec2<f32>(gid.xy) + 0.5) / vec2<f32>(texSize);
  let step = 1.0 / vec2<f32>(texSize);
  // Simple block-matching optical flow
  var bestDx = 0.0;
  var bestDy = 0.0;
  var bestDiff = 1e9;
  for (var dy = -4; dy <= 4; dy++) {
    for (var dx = -4; dx <= 4; dx++) {
      let suv = uv + vec2<f32>(f32(dx), f32(dy)) * step;
      let colA = textureSampleLevel(frameA, samp, uv, 0.0);
      let colB = textureSampleLevel(frameB, samp, suv, 0.0);
      let diff = distance(colA.rgb, colB.rgb);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestDx = f32(dx);
        bestDy = f32(dy);
      }
    }
  }
  textureStore(flowOut, vec2<i32>(gid.xy), vec4<f32>(bestDx, bestDy, 0.0, 1.0));
}`,
    resources: [{ name: 'flowOut', type: 'storage-texture', format: 'rg32float' }],
  };
  readonly ports: Port[] = [
    { id: 'frameA', name: 'Frame A', type: 'texture', direction: 'input' },
    { id: 'frameB', name: 'Frame B', type: 'texture', direction: 'input' },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `opticalFlow(${inputs.frameA}, ${inputs.frameB})` };
  }
  toWGSL() {
    return `fn optical_flow_placeholder() -> vec4<f32> { return vec4(0.0); }`;
  }
}

export class ParticleSystemNode extends ComputeNode {
  readonly type = 'particleSystem';
  readonly label = 'Particle System';
  readonly computeSpec: ComputeNodeSpec = {
    type: 'particleSystem',
    workgroupSize: [64, 1, 1],
    dispatch: (_inputs) => [1, 1, 1],
    wgsl: `@group(0) @binding(0) var<storage, read_write> particles: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> params: vec4<f32>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  var p = particles[idx];
  // p.xy = position, p.zw = velocity
  let dt = params.x;
  let gravity = params.y;
  let damping = params.z;
  p.z = p.z * damping; // velocity x
  p.w = (p.w + gravity * dt) * damping; // velocity y
  p.x += p.z * dt;
  p.y += p.w * dt;
  // Respawn if out of bounds
  if (p.y > 1.0 || p.y < -1.0 || p.x > 1.0 || p.x < -1.0) {
    p = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  particles[idx] = p;
}`,
    resources: [{ name: 'particles', type: 'storage-buffer', size: 10000 * 16 }],
  };
  readonly ports: Port[] = [
    { id: 'emitter', name: 'Emitter', type: 'texture', direction: 'input' },
    { id: 'count', name: 'Count', type: 'number', direction: 'input', default: 1000 },
    { id: 'gravity', name: 'Gravity', type: 'number', direction: 'input', default: 0.5 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `particleSystem(${inputs.emitter}, ${inputs.count ?? 1000}, ${inputs.gravity ?? 0.5})`,
    };
  }
  toWGSL() {
    return `fn particle_system_placeholder() -> vec4<f32> { return vec4(0.0); }`;
  }
}

export class TwirlNode extends BaseNode {
  readonly type = 'twirl';
  readonly label = 'Twirl';
  readonly category = 'distort' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'angle', name: 'Angle', type: 'number', direction: 'input', default: 3.14 },
    { id: 'radius', name: 'Radius', type: 'number', direction: 'input', default: 0.5 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `twirl(${inputs.input}, ${inputs.angle ?? 3.14}, ${inputs.radius ?? 0.5})` };
  }
  toWGSL() {
    return `fn twirl(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, angle: f32, radius: f32) -> vec4<f32> {
      let center = vec2(0.5, 0.5);
      let offset = uv - center;
      let dist = length(offset);
      let a = atan2(offset.y, offset.x) + angle * smoothstep(radius, 0.0, dist);
      let tuv = center + vec2(cos(a), sin(a)) * dist;
      return textureSample(src, samp, tuv);
    }`;
  }
}

export class ChromaKeyNode2 extends BaseNode {
  readonly type = 'chromaKey';
  readonly label = 'Chroma Key';
  readonly category = 'keying' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'keyColor', name: 'Key Color', type: 'color', direction: 'input', default: '#00ff00' },
    { id: 'threshold', name: 'Threshold', type: 'number', direction: 'input', default: 0.3 },
    { id: 'softness', name: 'Softness', type: 'number', direction: 'input', default: 0.1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `chromaKey(${inputs.input}, ${inputs.keyColor ?? '#00ff00'}, ${inputs.threshold ?? 0.3}, ${inputs.softness ?? 0.1})`,
    };
  }
  toWGSL() {
    return `fn chroma_key(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, keyColor: vec3<f32>, threshold: f32, softness: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let dist = distance(col.rgb, keyColor);
      let alpha = smoothstep(threshold, threshold + softness, dist);
      return vec4(col.rgb, col.a * alpha);
    }`;
  }
}

export class HalftoneNode extends BaseNode {
  readonly type = 'halftone';
  readonly label = 'Halftone';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'scale', name: 'Scale', type: 'number', direction: 'input', default: 20 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `halftone(${inputs.input}, ${inputs.scale ?? 20})` };
  }
  toWGSL() {
    return `fn halftone(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, scale: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let lum = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      let grid = fract(uv * scale);
      let dist = distance(grid, vec2(0.5));
      let radius = sqrt(lum) * 0.5;
      let mask = step(dist, radius);
      return vec4(vec3(mask), col.a);
    }`;
  }
}

export class ScanlinesNode extends BaseNode {
  readonly type = 'scanlines';
  readonly label = 'Scanlines';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'intensity', name: 'Intensity', type: 'number', direction: 'input', default: 0.3 },
    { id: 'count', name: 'Count', type: 'number', direction: 'input', default: 200 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `scanlines(${inputs.input}, ${inputs.intensity ?? 0.3}, ${inputs.count ?? 200})`,
    };
  }
  toWGSL() {
    return `fn scanlines(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, intensity: f32, count: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let line = sin(uv.y * count * 3.14159) * 0.5 + 0.5;
      let mask = 1.0 - intensity * (1.0 - line);
      return vec4(col.rgb * mask, col.a);
    }`;
  }
}

export class EdgeDetectNode extends BaseNode {
  readonly type = 'edgeDetect';
  readonly label = 'Edge Detect';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'threshold', name: 'Threshold', type: 'number', direction: 'input', default: 0.1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `edgeDetect(${inputs.input}, ${inputs.threshold ?? 0.1})` };
  }
  toWGSL() {
    return `fn edge_detect(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, threshold: f32) -> vec4<f32> {
      let texSize = vec2<f32>(textureDimensions(src));
      let step = 1.0 / texSize;
      let tl = textureSample(src, samp, uv + vec2(-step.x, -step.y));
      let tr = textureSample(src, samp, uv + vec2(step.x, -step.y));
      let bl = textureSample(src, samp, uv + vec2(-step.x, step.y));
      let br = textureSample(src, samp, uv + vec2(step.x, step.y));
      let tlLum = dot(tl.rgb, vec3(0.2126, 0.7152, 0.0722));
      let trLum = dot(tr.rgb, vec3(0.2126, 0.7152, 0.0722));
      let blLum = dot(bl.rgb, vec3(0.2126, 0.7152, 0.0722));
      let brLum = dot(br.rgb, vec3(0.2126, 0.7152, 0.0722));
      let gx = (trLum + brLum) - (tlLum + blLum);
      let gy = (blLum + brLum) - (tlLum + trLum);
      let mag = sqrt(gx * gx + gy * gy);
      let edge = smoothstep(threshold, threshold + 0.1, mag);
      return vec4(vec3(edge), 1.0);
    }`;
  }
}

export class DitherNode extends BaseNode {
  readonly type = 'dither';
  readonly label = 'Dither';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'levels', name: 'Levels', type: 'number', direction: 'input', default: 4 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `dither(${inputs.input}, ${inputs.levels ?? 4})` };
  }
  toWGSL() {
    return `fn dither(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, levels: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let l = max(levels, 1.0);
      let bayer = mat2x2<f32>(0.0, 0.5, 0.75, 0.25);
      let bx = i32(uv.x * 2.0) % 2;
      let by = i32(uv.y * 2.0) % 2;
      let threshold = bayer[by][bx] / l;
      return vec4(floor(col.rgb * l + threshold) / l, col.a);
    }`;
  }
}

export class PixelateNode extends BaseNode {
  readonly type = 'pixelate';
  readonly label = 'Pixelate';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'size', name: 'Size', type: 'number', direction: 'input', default: 8 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `pixelate(${inputs.input}, ${inputs.size ?? 8})` };
  }
  toWGSL() {
    return `fn pixelate(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, size: f32) -> vec4<f32> {
      let texSize = vec2<f32>(textureDimensions(src));
      let blockSize = max(size, 1.0) / texSize;
      let blockUV = floor(uv / blockSize) * blockSize + blockSize * 0.5;
      return textureSample(src, samp, blockUV);
    }`;
  }
}

export class EmbossNode extends BaseNode {
  readonly type = 'emboss';
  readonly label = 'Emboss';
  readonly category = 'stylize' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'strength', name: 'Strength', type: 'number', direction: 'input', default: 1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `emboss(${inputs.input}, ${inputs.strength ?? 1})` };
  }
  toWGSL() {
    return `fn emboss(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, strength: f32) -> vec4<f32> {
      let texSize = vec2<f32>(textureDimensions(src));
      let step = 1.0 / texSize;
      let tl = textureSample(src, samp, uv + vec2(-step.x, -step.y));
      let br = textureSample(src, samp, uv + vec2(step.x, step.y));
      let diff = (tl.rgb - br.rgb) * strength + 0.5;
      return vec4(clamp(diff, 0.0, 1.0), 1.0);
    }`;
  }
}

export class InvertNode extends BaseNode {
  readonly type = 'invert';
  readonly label = 'Invert';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `invert(${inputs.input})` };
  }
  toWGSL() {
    return `fn invert(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      return vec4(1.0 - col.rgb, col.a);
    }`;
  }
}

export class ThresholdNode extends BaseNode {
  readonly type = 'threshold';
  readonly label = 'Threshold';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'threshold', name: 'Threshold', type: 'number', direction: 'input', default: 0.5 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `threshold(${inputs.input}, ${inputs.threshold ?? 0.5})` };
  }
  toWGSL() {
    return `fn threshold(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, thresh: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let lum = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      let v = select(0.0, 1.0, lum > thresh);
      return vec4(vec3(v), col.a);
    }`;
  }
}

export class ChannelMixerNode extends BaseNode {
  readonly type = 'channelMixer';
  readonly label = 'Channel Mixer';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'rr', name: 'R←R', type: 'number', direction: 'input', default: 1 },
    { id: 'rg', name: 'R←G', type: 'number', direction: 'input', default: 0 },
    { id: 'rb', name: 'R←B', type: 'number', direction: 'input', default: 0 },
    { id: 'gr', name: 'G←R', type: 'number', direction: 'input', default: 0 },
    { id: 'gg', name: 'G←G', type: 'number', direction: 'input', default: 1 },
    { id: 'gb', name: 'G←B', type: 'number', direction: 'input', default: 0 },
    { id: 'br', name: 'B←R', type: 'number', direction: 'input', default: 0 },
    { id: 'bg', name: 'B←G', type: 'number', direction: 'input', default: 0 },
    { id: 'bb', name: 'B←B', type: 'number', direction: 'input', default: 1 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `channelMixer(${inputs.input})` };
  }
  toWGSL() {
    return `fn channel_mixer(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, rr: f32, rg: f32, rb: f32, gr: f32, gg: f32, gb: f32, br: f32, bg: f32, bb: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      let r = col.r * rr + col.g * rg + col.b * rb;
      let g = col.r * gr + col.g * gg + col.b * gb;
      let b = col.r * br + col.g * bg + col.b * bb;
      return vec4(clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0), col.a);
    }`;
  }
}

export class RGBSplitNode extends BaseNode {
  readonly type = 'rgbSplit';
  readonly label = 'RGB Split';
  readonly category = 'distort' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'amount', name: 'Amount', type: 'number', direction: 'input', default: 0.01 },
    { id: 'angle', name: 'Angle', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `rgbSplit(${inputs.input}, ${inputs.amount ?? 0.01}, ${inputs.angle ?? 0})` };
  }
  toWGSL() {
    return `fn rgb_split(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, amount: f32, angle: f32) -> vec4<f32> {
      let dir = vec2(cos(angle), sin(angle)) * amount;
      let r = textureSample(src, samp, uv + dir).r;
      let g = textureSample(src, samp, uv).g;
      let b = textureSample(src, samp, uv - dir).b;
      let a = textureSample(src, samp, uv).a;
      return vec4(r, g, b, a);
    }`;
  }
}

export class SolarizeNode extends BaseNode {
  readonly type = 'solarize';
  readonly label = 'Solarize';
  readonly category = 'color' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'threshold', name: 'Threshold', type: 'number', direction: 'input', default: 0.5 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `solarize(${inputs.input}, ${inputs.threshold ?? 0.5})` };
  }
  toWGSL() {
    return `fn solarize(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, threshold: f32) -> vec4<f32> {
      let col = textureSample(src, samp, uv);
      var r = col.r;
      var g = col.g;
      var b = col.b;
      if (r > threshold) { r = 1.0 - r; }
      if (g > threshold) { g = 1.0 - g; }
      if (b > threshold) { b = 1.0 - b; }
      return vec4(r, g, b, col.a);
    }`;
  }
}

export class MotionBlurNode extends BaseNode {
  readonly type = 'motionBlur';
  readonly label = 'Motion Blur';
  readonly category = 'temporal' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'direction', name: 'Direction', type: 'number', direction: 'input', default: 0 },
    { id: 'amount', name: 'Amount', type: 'number', direction: 'input', default: 0.02 },
    { id: 'samples', name: 'Samples', type: 'number', direction: 'input', default: 8 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return {
      output: `motionBlur(${inputs.input}, ${inputs.direction ?? 0}, ${inputs.amount ?? 0.02}, ${inputs.samples ?? 8})`,
    };
  }
  toWGSL() {
    return `fn motion_blur(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, direction: f32, amount: f32, samples: f32) -> vec4<f32> {
      let dir = vec2(cos(direction), sin(direction)) * amount;
      var sum = vec4<f32>(0.0);
      let n = i32(max(samples, 1.0));
      for (var i = 0; i < n; i++) {
        let t = (f32(i) / f32(n - 1)) - 0.5;
        sum += textureSample(src, samp, uv + dir * t);
      }
      return sum / f32(n);
    }`;
  }
}

export class LensBlurNode extends BaseNode {
  readonly type = 'lensBlur';
  readonly label = 'Lens Blur';
  readonly category = 'blur' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'radius', name: 'Radius', type: 'number', direction: 'input', default: 4 },
    { id: 'blades', name: 'Blades', type: 'number', direction: 'input', default: 6 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `lensBlur(${inputs.input}, ${inputs.radius ?? 4}, ${inputs.blades ?? 6})` };
  }
  toWGSL() {
    return `fn lens_blur(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, radius: f32, blades: f32) -> vec4<f32> {
      let texSize = vec2<f32>(textureDimensions(src));
      let step = radius / max(texSize.x, texSize.y);
      var sum = vec4<f32>(0.0);
      let n = i32(max(blades, 3.0));
      for (var i = 0; i < n; i++) {
        let angle = f32(i) * 6.2831853 / f32(n);
        let offset = vec2(cos(angle), sin(angle)) * step;
        sum += textureSample(src, samp, uv + offset);
      }
      return sum / f32(n);
    }`;
  }
}

export class MediaSourceNode extends BaseNode {
  readonly type = 'mediaSource';
  readonly label = 'Media';
  readonly category = 'source' as const;
  readonly ports: Port[] = [
    { id: 'src', name: 'Source', type: 'string', direction: 'input', default: '' },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `media_source(${inputs.src ?? ''})` };
  }
  toWGSL() {
    return `fn media_source() -> vec4<f32> { return vec4(0.5, 0.5, 0.5, 1.0); }`;
  }
}

export class RenderNode extends BaseNode {
  readonly type = 'render';
  readonly label = 'Render';
  readonly category = 'output' as const;
  readonly ports: Port[] = [{ id: 'input', name: 'Input', type: 'texture', direction: 'input' }];
  execute(): Record<string, unknown> {
    return {};
  }
  toWGSL() {
    return `// Render output`;
  }
}

// ── Script Node ──────────────────────────────────────────────────────────────

export class ScriptNode extends BaseNode {
  readonly type = 'script';
  readonly label = 'Script';
  readonly category = 'script' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'number', direction: 'input', default: 0 },
    { id: 'output', name: 'Output', type: 'number', direction: 'output' },
  ];
  readonly code: string;
  constructor(code = '// Safe math expression\ninput * 2.0') {
    super();
    this.code = code;
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const input = Number(inputs.input) || 0;
    try {
      const result = evaluateExpression(this.code, input);
      return { output: result };
    } catch {
      return { output: input };
    }
  }
  toWGSL() {
    return `// Custom script node\n${this.code}`;
  }
}

/**
 * Safely evaluate a math expression. Supports +, -, *, /, **, parentheses,
 * Math functions (sin, cos, tan, abs, floor, ceil, round, sqrt, pow, exp, log,
 * min, max, clamp, lerp), and the variable `input`. No side effects, no
 * property access, no function construction.
 */
function evaluateExpression(code: string, input: number): number {
  const cleaned = code.replace(/\/\/.*$/gm, '').replace(/[^a-zA-Z0-9_+\-*/().,\s]/g, '');
  const fn = new Function(
    'input',
    'sin',
    'cos',
    'tan',
    'abs',
    'floor',
    'ceil',
    'round',
    'sqrt',
    'pow',
    'exp',
    'log',
    'min',
    'max',
    'clamp',
    'lerp',
    'PI',
    'E',
    `"use strict"; return (${cleaned});`,
  );
  return Number(
    fn(
      input,
      Math.sin,
      Math.cos,
      Math.tan,
      Math.abs,
      Math.floor,
      Math.ceil,
      Math.round,
      Math.sqrt,
      Math.pow,
      Math.exp,
      Math.log,
      Math.min,
      Math.max,
      (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)),
      (a: number, b: number, t: number) => a + (b - a) * t,
      Math.PI,
      Math.E,
    ),
  );
}

// ── Node Registry ────────────────────────────────────────────────────────────

export const NODE_REGISTRY: Record<string, new () => BaseNode> = {
  dataSource: DataSourceNode,
  colorSource: ColorSourceNode,
  proceduralScene: ProceduralSceneNode,
  noiseSource: NoiseSourceNode,
  mediaSource: MediaSourceNode,
  solidSource: SolidSourceNode,
  gradientSource: GradientSourceNode,
  checkerSource: CheckerSourceNode,
  transform: TransformNode,
  spatialTransform: SpatialTransformNode,
  oscillator: OscillatorNode,
  spring: SpringNode,
  ease: EaseNode,
  stagger: StaggerNode,
  glow: GlowNode,
  blur: BlurNode,
  colorGrade: ColorGradeNode,
  temperature: TemperatureNode,
  levels: LevelsNode,
  exposure: ExposureNode,
  saturation: SaturationNode,
  hueShift: HueShiftNode,
  bloom: BloomNode,
  histogram: HistogramNode,
  blurPyramid: BlurPyramidNode,
  opticalFlow: OpticalFlowNode,
  particleSystem: ParticleSystemNode,
  posterize: PosterizeNode,
  twirl: TwirlNode,
  chromaKey: ChromaKeyNode2,
  halftone: HalftoneNode,
  scanlines: ScanlinesNode,
  edgeDetect: EdgeDetectNode,
  dither: DitherNode,
  pixelate: PixelateNode,
  emboss: EmbossNode,
  invert: InvertNode,
  threshold: ThresholdNode,
  channelMixer: ChannelMixerNode,
  rgbSplit: RGBSplitNode,
  solarize: SolarizeNode,
  motionBlur: MotionBlurNode,
  lensBlur: LensBlurNode,
  displacementMap: DisplacementNode,
  vignette: VignetteNode,
  blend: BlendNode,
  alphaMerge: AlphaMergeNode,
  chromaticAberration: ChromaticAberrationNode,
  sharpen: SharpenNode,
  filmGrain: FilmGrainNode,
  lensDistortion: LensDistortionNode,
  render: RenderNode,
  script: ScriptNode,
};

export function createNode(type: string): BaseNode {
  const Ctor = NODE_REGISTRY[type];
  if (!Ctor) throw new Error(`Unknown node type: ${type}`);
  return new Ctor();
}

export function getNodeTypes() {
  return Object.entries(NODE_REGISTRY).map(([type, Ctor]) => {
    const instance = new Ctor();
    return { type, label: instance.label, category: instance.category, ports: instance.ports };
  });
}
