// ── Text rasterising ─────────────────────────────────────────────────────────
// The GPU has no font, so a title is drawn by the editor: the words are set
// in a 2D canvas and handed to the GPU as a texture, which the node samples.
//
// The canvas is transparent everywhere except the glyphs, so the node's alpha
// is the coverage of the letters and the title composites over the picture.

/** How a title is set. */
export interface TextStyle {
  /** The words. */
  text: string;
  /** Cap height in pixels of the texture. */
  size: number;
  /** Where the title sits, 0..1 across the frame. */
  x: number;
  y: number;
  /** The colour, '#rrggbb'. */
  colour: string;
  /** The font family. */
  font: string;
  /** The weight. */
  weight: number;
}

/** The size of the texture a title is drawn into. */
export const TEXT_TEXTURE_SIZE = 1024;

/** A title's default look. */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  text: 'A title',
  size: 96,
  x: 0.5,
  y: 0.12,
  colour: '#ffffff',
  font: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
  weight: 700,
};

/**
 * Draw a title into a canvas and return its pixels.
 *
 * The title is centred on `x` and sits on `y`, both as fractions of the
 * frame, so the same style works at any resolution.
 */
export function rasteriseText(style: TextStyle, size = TEXT_TEXTURE_SIZE): ImageData | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.font = `${style.weight} ${style.size}px ${style.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = style.colour;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = style.size * 0.12;
  ctx.shadowOffsetY = style.size * 0.02;
  ctx.fillText(style.text, style.x * size, style.y * size);
  return ctx.getImageData(0, 0, size, size);
}

/** A style read from a node's parameters, with the defaults filled in. */
export function textStyleFrom(params: Record<string, unknown>): TextStyle {
  const read = (key: string, fallback: unknown) =>
    params[key] === undefined ? fallback : params[key];
  return {
    text: String(read('text', DEFAULT_TEXT_STYLE.text)),
    size: Number(read('size', DEFAULT_TEXT_STYLE.size)) || DEFAULT_TEXT_STYLE.size,
    x: Number(read('x', DEFAULT_TEXT_STYLE.x)),
    y: Number(read('y', DEFAULT_TEXT_STYLE.y)),
    colour: String(read('colour', DEFAULT_TEXT_STYLE.colour)),
    font: String(read('font', DEFAULT_TEXT_STYLE.font)),
    weight: Number(read('weight', DEFAULT_TEXT_STYLE.weight)) || DEFAULT_TEXT_STYLE.weight,
  };
}
