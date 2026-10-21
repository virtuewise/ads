// ── Port vocabulary ──────────────────────────────────────────────────────────
// The types a port can carry, and the rules for connecting them.
//
// A port's *declared* type is what the user sees in the editor. It is not
// precise enough to validate a connection on its own: "texture" covers both a
// sampled image and a colour value, and the two are not interchangeable — a
// blur samples its input, a glow adds to it.
//
// So there are two vocabularies:
//   - `PortType`  — the coarse, user-facing type.
//   - `ValueType` — the precise type a port actually carries, which the node's
//                   implementation knows and the compiler derives from the
//                   generated shader's signature.
//
// The rules below are the only place connection compatibility is decided.

/** The coarse type shown in the editor. */
export type PortType = 'texture' | 'number' | 'color' | 'boolean' | 'audio' | 'string';

/** The precise type a port carries. */
export type ValueType = 'image' | 'color' | 'number' | 'boolean' | 'string' | 'audio';

export const VALUE_TYPES: readonly ValueType[] = [
  'image',
  'color',
  'number',
  'boolean',
  'string',
  'audio',
];

/**
 * Which value types may feed which.
 *
 * A colour is a vec4 and a number is a scalar: neither converts to the other
 * implicitly in WGSL, so neither may be connected to the other. Numbers and
 * booleans are interchangeable, because WGSL will widen a boolean to a float
 * without complaint.
 *
 * A colour may be sampled: in a renderer every node's output is a rendered
 * image, and a 1×1 image is a colour. That is why `blur` can follow `glow`.
 * An image may not be used as a value — it has to be sampled by the node that
 * takes it.
 */
const COMPATIBLE: Record<ValueType, readonly ValueType[]> = {
  image: ['image'],
  color: ['color', 'image'],
  number: ['number', 'boolean'],
  boolean: ['boolean', 'number'],
  string: ['string'],
  audio: ['audio'],
};

/**
 * Whether a value of type `from` can be used where `to` is expected.
 *
 * This is the check that stops an image being wired into a number slot: the
 * compiler would otherwise discover it only when it built the shader, by then
 * as an opaque WGSL type error.
 */
export function canConnect(from: ValueType, to: ValueType): boolean {
  return COMPATIBLE[from].includes(to);
}

/** A human-readable reason a connection is not allowed. */
export function connectionError(from: ValueType, to: ValueType): string | null {
  if (canConnect(from, to)) return null;
  if (from === 'image') {
    return `An image cannot be used as a ${to}: it has to be sampled by the node that takes it.`;
  }
  return `A ${from} cannot be connected to a ${to}.`;
}

/** The coarse type a precise value type is shown as. */
export function portTypeFor(value: ValueType): PortType {
  switch (value) {
    case 'image':
      return 'texture';
    case 'color':
      return 'color';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
      return 'string';
    case 'audio':
      return 'audio';
  }
}
