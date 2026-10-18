// ── Node System ──────────────────────────────────────────────────────────────
// Every visual node is a TypeScript class. Nodes serialize to JSON and compile
// to WGSL fragment shaders for the WebGPU pipeline.

import type { Port } from './types';

export abstract class BaseNode {
  abstract readonly type: string;
  abstract readonly label: string;
  abstract readonly category: 'source' | 'transform' | 'effect' | 'composite' | 'output' | 'script';
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
    return `fn ease(t: f32) -> f32 { return t < 0.5 ? 2.0*t*t : 1.0 - pow(2.0*t + 2.0, 2.0) / 2.0; }`;
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
    return `fn blur(color: vec4<f32>, radius: f32) -> vec4<f32> { return color * 0.8; }`;
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
    return { output: `colorGrade(${inputs.input})` };
  }
  toWGSL() {
    return `fn color_grade(color: vec4<f32>, lift: vec3<f32>, gamma: vec3<f32>, gain: vec3<f32>) -> vec4<f32> { return vec4(pow((color.rgb + lift) * gain, 1.0 / gamma), color.a); }`;
  }
}

export class VignetteNode extends BaseNode {
  readonly type = 'vignette';
  readonly label = 'Vignette';
  readonly category = 'effect' as const;
  readonly ports: Port[] = [
    { id: 'input', name: 'Input', type: 'texture', direction: 'input' },
    { id: 'intensity', name: 'Intensity', type: 'number', direction: 'input', default: 0.3 },
    { id: 'output', name: 'Output', type: 'texture', direction: 'output' },
  ];
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { output: `vignette(${inputs.input}, ${inputs.intensity ?? 0.3})` };
  }
  toWGSL() {
    return `fn vignette(color: vec4<f32>, intensity: f32) -> vec4<f32> { let d = distance(vec2(0.5), vec2(0.5)); return color * (1.0 - intensity * d); }`;
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
    return { output: `blend(${inputs.inputA}, ${inputs.inputB}, ${inputs.opacity ?? 0.5})` };
  }
  toWGSL() {
    return `fn blend(a: vec4<f32>, b: vec4<f32>, opacity: f32) -> vec4<f32> { return mix(a, b, opacity); }`;
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
    return `fn alpha_merge(fg: vec4<f32>, bg: vec4<f32>) -> vec4<f32> { return vec4(fg.rgb * fg.a + bg.rgb * (1.0 - fg.a), 1.0); }`;
  }
}

// ── Output Nodes ─────────────────────────────────────────────────────────────

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
  constructor(code = '// Custom WGSL or JS\nreturn input * 2.0;') {
    super();
    this.code = code;
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    try {
      const fn = new Function('input', this.code);
      return { output: fn(inputs.input ?? 0) };
    } catch {
      return { output: inputs.input ?? 0 };
    }
  }
  toWGSL() {
    return `// Custom script node\n${this.code}`;
  }
}

// ── Node Registry ────────────────────────────────────────────────────────────

export const NODE_REGISTRY: Record<string, new () => BaseNode> = {
  dataSource: DataSourceNode,
  colorSource: ColorSourceNode,
  noiseSource: NoiseSourceNode,
  transform: TransformNode,
  ease: EaseNode,
  stagger: StaggerNode,
  glow: GlowNode,
  blur: BlurNode,
  colorGrade: ColorGradeNode,
  vignette: VignetteNode,
  blend: BlendNode,
  alphaMerge: AlphaMergeNode,
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
