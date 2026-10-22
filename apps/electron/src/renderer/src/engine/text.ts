// ── Text layers ──────────────────────────────────────────────────────────────
// Text is rasterised by the renderer and sampled by the graph's TextNode. The
// graph and timeline remain the source of truth, so the exact same pixels feed
// viewport playback and export.

import { sampleProperty } from './timeline';
import type { DAG, NodeInstance, TimelineClip } from './types';

export interface TextStyle {
  text: string;
  /** Font size in pixels in the editor's 1024 × 1024 title texture. */
  size: number;
  /** Normalised anchor point in the composition. */
  x: number;
  y: number;
  colour: string;
  font: string;
  weight: number;
  align?: CanvasTextAlign;
  lineHeight?: number;
  opacity?: number;
  scale?: number;
  rotation?: number;
  reveal?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  padding?: number;
  accentColor?: string;
}

export type TextMotion = 'fade-rise' | 'slide-in' | 'pop' | 'caption-fade' | 'typewriter';

export interface TextLayerPreset {
  id: 'headline' | 'lower-third' | 'cta' | 'caption' | 'chapter';
  label: string;
  description: string;
  motion: TextMotion;
  style: TextStyle;
}

export const TEXT_TEXTURE_SIZE = 1024;

export const DEFAULT_TEXT_STYLE: TextStyle = {
  text: 'Your headline',
  size: 96,
  x: 0.5,
  y: 0.18,
  colour: '#ffffff',
  font: 'Inter, "Segoe UI", system-ui, sans-serif',
  weight: 800,
  align: 'center',
  lineHeight: 1.12,
  opacity: 1,
  scale: 1,
  rotation: 0,
  reveal: 1,
};

/** Reusable starting treatments. Every value remains editable after insertion. */
export const TEXT_LAYER_PRESETS: TextLayerPreset[] = [
  {
    id: 'headline',
    label: 'Headline',
    description: 'A strong opening line with a soft, confident rise.',
    motion: 'fade-rise',
    style: { ...DEFAULT_TEXT_STYLE, text: 'A bold new idea', size: 92, y: 0.2 },
  },
  {
    id: 'lower-third',
    label: 'Lower third',
    description: 'Speaker identification with a branded edge.',
    motion: 'slide-in',
    style: {
      ...DEFAULT_TEXT_STYLE,
      text: 'Jordan Lee\nCreative Director',
      size: 40,
      x: 0.1,
      y: 0.8,
      align: 'left',
      weight: 650,
      lineHeight: 1.22,
      backgroundColor: '#101722',
      backgroundOpacity: 0.82,
      padding: 18,
      accentColor: '#ff5a2c',
    },
  },
  {
    id: 'cta',
    label: 'Call to action',
    description: 'A high-contrast end card with a subtle scale punch.',
    motion: 'pop',
    style: {
      ...DEFAULT_TEXT_STYLE,
      text: 'MAKE YOUR NEXT MOVE',
      size: 48,
      y: 0.84,
      backgroundColor: '#ff5a2c',
      backgroundOpacity: 0.96,
      padding: 20,
    },
  },
  {
    id: 'caption',
    label: 'Caption',
    description: 'Readable, safe-area caption with a quiet fade.',
    motion: 'caption-fade',
    style: {
      ...DEFAULT_TEXT_STYLE,
      text: 'Type a caption…',
      size: 38,
      y: 0.86,
      weight: 650,
      backgroundColor: '#080a0f',
      backgroundOpacity: 0.84,
      padding: 16,
    },
  },
  {
    id: 'chapter',
    label: 'Chapter card',
    description: 'A cinematic section marker with a measured reveal.',
    motion: 'typewriter',
    style: {
      ...DEFAULT_TEXT_STYLE,
      text: '01  /  THE OPENING',
      size: 58,
      y: 0.5,
      weight: 750,
      colour: '#e7edf7',
    },
  },
];

export function textStyleFrom(params: Record<string, unknown>): TextStyle {
  const readNumber = (key: string, fallback: number) => {
    const value = params[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };
  const readString = (key: string, fallback: string) =>
    typeof params[key] === 'string' ? String(params[key]) : fallback;

  const align = params.align;
  return {
    ...DEFAULT_TEXT_STYLE,
    text: readString('text', DEFAULT_TEXT_STYLE.text),
    size: Math.max(8, Math.min(360, readNumber('size', DEFAULT_TEXT_STYLE.size))),
    x: Math.max(0, Math.min(1, readNumber('x', DEFAULT_TEXT_STYLE.x))),
    y: Math.max(0, Math.min(1, readNumber('y', DEFAULT_TEXT_STYLE.y))),
    colour: readString('colour', DEFAULT_TEXT_STYLE.colour),
    font: readString('font', DEFAULT_TEXT_STYLE.font),
    weight: Math.max(100, Math.min(900, readNumber('weight', DEFAULT_TEXT_STYLE.weight))),
    align: align === 'left' || align === 'right' ? align : 'center',
    lineHeight: Math.max(0.8, Math.min(2, readNumber('lineHeight', 1.12))),
    opacity: Math.max(0, Math.min(1, readNumber('opacity', 1))),
    scale: Math.max(0.01, Math.min(5, readNumber('scale', 1))),
    rotation: readNumber('rotation', 0),
    reveal: Math.max(0, Math.min(1, readNumber('reveal', 1))),
    backgroundColor: readString('backgroundColor', ''),
    backgroundOpacity: Math.max(0, Math.min(1, readNumber('backgroundOpacity', 0))),
    padding: Math.max(0, Math.min(120, readNumber('padding', 0))),
    accentColor: readString('accentColor', ''),
  };
}

/** Sample the independent animation channels for a title at an absolute time. */
export function animatedTextStyle(style: TextStyle, clip: TimelineClip, time: number): TextStyle {
  const sample = (property: string, fallback: number) =>
    sampleProperty(clip.keyframes, time, property, fallback);
  return {
    ...style,
    opacity: sample('opacity', style.opacity ?? 1),
    scale: sample('scale', style.scale ?? 1),
    x: sample('x', style.x),
    y: sample('y', style.y),
    rotation: sample('rotation', style.rotation ?? 0),
    reveal: sample('reveal', style.reveal ?? 1),
  };
}

/** Draw a multiline title treatment into the transparent app texture. */
export function rasteriseText(style: TextStyle, size = TEXT_TEXTURE_SIZE): ImageData | null {
  if (typeof document === 'undefined' || !Number.isFinite(size) || size < 1) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const text = Array.from(style.text).slice(0, 500).join('');
  const visibleText = Array.from(text)
    .slice(0, Math.ceil(text.length * (style.reveal ?? 1)))
    .join('');
  const lines = visibleText.split(/\r?\n/).slice(0, 8);
  const x = Math.max(0, Math.min(1, style.x)) * size;
  const y = Math.max(0, Math.min(1, style.y)) * size;
  const fontSize = Math.max(8, Math.min(360, style.size)) * Math.max(0.01, style.scale ?? 1);
  const lineHeight = fontSize * Math.max(0.8, Math.min(2, style.lineHeight ?? 1.12));
  const padding = Math.max(0, style.padding ?? 0) * Math.max(0.01, style.scale ?? 1);
  const align = style.align ?? 'center';

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, style.opacity ?? 1));
  ctx.translate(x, y);
  ctx.rotate(((style.rotation ?? 0) * Math.PI) / 180);
  ctx.font = `${Math.max(100, Math.min(900, style.weight))} ${fontSize}px ${style.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  const widths = lines.map((line) => ctx.measureText(line || ' ').width);
  const contentWidth = Math.max(0, ...widths);
  const contentHeight = Math.max(fontSize, lines.length * lineHeight);
  const left = align === 'left' ? 0 : align === 'right' ? -contentWidth : -contentWidth / 2;
  if (style.backgroundColor && (style.backgroundOpacity ?? 0) > 0 && lines.some(Boolean)) {
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, style.backgroundOpacity ?? 0));
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(
      left - padding,
      -contentHeight / 2 - padding,
      contentWidth + padding * 2,
      contentHeight + padding * 2,
    );
    if (style.accentColor) {
      ctx.fillStyle = style.accentColor;
      ctx.fillRect(
        left - padding,
        -contentHeight / 2 - padding,
        Math.max(4, padding * 0.22),
        contentHeight + padding * 2,
      );
    }
    ctx.restore();
  }

  ctx.fillStyle = style.colour;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = fontSize * 0.12;
  ctx.shadowOffsetY = fontSize * 0.02;
  lines.forEach((line, index) => {
    ctx.fillText(line, 0, (index - (lines.length - 1) / 2) * lineHeight, size * 0.94);
  });
  ctx.restore();
  return ctx.getImageData(0, 0, size, size);
}

export interface TextLayerInput {
  name: string;
  style: TextStyle;
}

/** Append editor-authored TextNodes to the active render path. */
export function appendTextNodesToGraph(
  graph: DAG,
  layers: TextLayerInput[],
): { graph: DAG; nodeIds: string[] } {
  if (layers.length === 0) return { graph, nodeIds: [] };
  const render = graph.nodes.find((node) => node.type === 'render');
  if (!render) throw new Error('The project graph has no Render output node.');

  const renderEdges = graph.edges.filter(
    (edge) => edge.to.node === render.id && edge.to.port === 'input',
  );
  const renderEdge = renderEdges.at(-1);
  const source =
    renderEdge?.from ??
    (() => {
      const node = graph.nodes.find(
        (item) => item.type === 'proceduralScene' || item.type === 'mediaSource',
      );
      return node ? { node: node.id, port: 'output' } : null;
    })();
  if (!source) throw new Error('Add a visual source to the graph before creating a title.');

  const nodes = [...graph.nodes];
  const edges = graph.edges.filter(
    (edge) => edge.to.node !== render.id || edge.to.port !== 'input',
  );
  const usedIds = new Set(nodes.map((node) => node.id));
  const usedEdgeIds = new Set(edges.map((edge) => edge.id));
  const unique = (base: string, used: Set<string>) => {
    let id = base;
    let suffix = 1;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id;
  };
  let from = source;
  const nodeIds: string[] = [];

  for (const [index, layer] of layers.entries()) {
    const id = unique(`text-${Date.now().toString(36)}-${index + 1}`, usedIds);
    const node: NodeInstance = {
      id,
      type: 'text',
      position: { x: 180 + index * 260, y: 220 },
      inputs: { ...layer.style, editorLayer: true, layerName: layer.name },
      outputs: {},
    };
    nodes.push(node);
    edges.push({
      id: unique(`edge-${id}-in`, usedEdgeIds),
      from,
      to: { node: id, port: 'input' },
    });
    nodeIds.push(id);
    from = { node: id, port: 'output' };
  }

  edges.push({
    id: unique(`edge-${nodeIds.at(-1)}-render`, usedEdgeIds),
    from,
    to: { node: render.id, port: 'input' },
  });
  return { graph: { nodes, edges }, nodeIds };
}

/** Remove editor title nodes and reconnect the render path through their gap. */
export function removeTextNodesFromGraph(graph: DAG, nodeIds: Set<string>): DAG {
  let nodes = [...graph.nodes];
  let edges = [...graph.edges];
  for (const id of nodeIds) {
    const node = nodes.find((item) => item.id === id && item.type === 'text');
    if (!node) continue;
    const incoming = edges.filter((edge) => edge.to.node === id);
    const outgoing = edges.filter((edge) => edge.from.node === id);
    edges = edges.filter((edge) => edge.from.node !== id && edge.to.node !== id);
    for (const edgeIn of incoming) {
      for (const edgeOut of outgoing) {
        edges.push({
          id: `edge-remove-${id}-${edgeIn.id}-${edgeOut.id}`,
          from: edgeIn.from,
          to: edgeOut.to,
        });
      }
    }
    nodes = nodes.filter((item) => item.id !== id);
  }
  return { nodes, edges };
}
