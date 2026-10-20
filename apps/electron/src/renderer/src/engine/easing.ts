// ── Easing Library ────────────────────────────────────────────────────────────
// The canonical easing math shared by the timeline sampler, the Ease node,
// and the WGSL compiler. See docs/32-KEYFRAME-ANIMATION.md §10 and
// docs/40-ANIMATION-PRINCIPLES.md §3.

import type { KeyframeEasing } from './types';

/** Display name for each easing, used by the UI and the node inspector. */
export const EASING_LABELS: Record<KeyframeEasing, string> = {
  linear: 'Linear',
  easeIn: 'Ease In (Quad)',
  easeOut: 'Ease Out (Quad)',
  easeInOut: 'Ease In Out (Quad)',
  sineIn: 'Sine In',
  sineOut: 'Sine Out',
  sineInOut: 'Sine In Out',
  cubicIn: 'Cubic In',
  cubicOut: 'Cubic Out',
  cubicInOut: 'Cubic In Out',
  quartIn: 'Quart In',
  quartOut: 'Quart Out',
  quartInOut: 'Quart In Out',
  expoIn: 'Expo In',
  expoOut: 'Expo Out',
  expoInOut: 'Expo In Out',
  backIn: 'Back In (Overshoot)',
  backOut: 'Back Out (Overshoot)',
  backInOut: 'Back In Out',
  elasticIn: 'Elastic In',
  elasticOut: 'Elastic Out',
  elasticInOut: 'Elastic In Out',
  bounceIn: 'Bounce In',
  bounceOut: 'Bounce Out',
  bounceInOut: 'Bounce In Out',
};

/** The full easing list, in UI order. */
export const EASING_ORDER: KeyframeEasing[] = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'sineIn',
  'sineOut',
  'sineInOut',
  'cubicIn',
  'cubicOut',
  'cubicInOut',
  'quartIn',
  'quartOut',
  'quartInOut',
  'expoIn',
  'expoOut',
  'expoInOut',
  'backIn',
  'backOut',
  'backInOut',
  'elasticIn',
  'elasticOut',
  'elasticInOut',
  'bounceIn',
  'bounceOut',
  'bounceInOut',
];

const C1 = 1.70158;
const C2 = C1 * 1.525;
const C3 = C1 + 1;
const C4 = (2 * Math.PI) / 3;
const C5 = (2 * Math.PI) / 4.5;

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t - 1.5 / d1) * (t - 1.5 / d1) + 0.75;
  if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) * (t - 2.25 / d1) + 0.9375;
  return n1 * (t - 2.625 / d1) * (t - 2.625 / d1) + 0.984375;
}

/** Evaluate an easing function. This is the single source of truth. */
export function easeValue(t: number, kind: KeyframeEasing): number {
  switch (kind) {
    case 'linear':
      return t;
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case 'sineIn':
      return 1 - Math.cos((t * Math.PI) / 2);
    case 'sineOut':
      return Math.sin((t * Math.PI) / 2);
    case 'sineInOut':
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case 'cubicIn':
      return t * t * t;
    case 'cubicOut':
      return 1 - (1 - t) ** 3;
    case 'cubicInOut':
      return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    case 'quartIn':
      return t * t * t * t;
    case 'quartOut':
      return 1 - (1 - t) ** 4;
    case 'quartInOut':
      return t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2;
    case 'expoIn':
      return t === 0 ? 0 : 2 ** (10 * t - 10);
    case 'expoOut':
      return t === 1 ? 1 : 1 - 2 ** (-10 * t);
    case 'expoInOut':
      if (t === 0) return 0;
      if (t === 1) return 1;
      return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
    case 'backIn':
      return C3 * t * t * t - C1 * t * t;
    case 'backOut':
      return 1 + C3 * (t - 1) ** 3 + C1 * (t - 1) ** 2;
    case 'backInOut':
      return t < 0.5
        ? ((2 * t) ** 2 * ((C2 + 1) * 2 * t - C2)) / 2
        : ((2 * t - 2) ** 2 * ((C2 + 1) * (t * 2 - 2) + C2) + 2) / 2;
    case 'elasticIn':
      if (t === 0) return 0;
      if (t === 1) return 1;
      return -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * C4);
    case 'elasticOut':
      if (t === 0) return 0;
      if (t === 1) return 1;
      return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * C4) + 1;
    case 'elasticInOut':
      if (t === 0) return 0;
      if (t === 1) return 1;
      return t < 0.5
        ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * C5)) / 2
        : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * C5)) / 2 + 1;
    case 'bounceIn':
      return 1 - bounceOut(1 - t);
    case 'bounceOut':
      return bounceOut(t);
    case 'bounceInOut':
      return t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2;
    default:
      return t;
  }
}

/** Map an easing name to a stable integer for the WGSL path. */
export function easeKindIndex(kind: KeyframeEasing): number {
  return EASING_ORDER.indexOf(kind);
}

/**
 * WGSL implementation of the full easing library, driven by an integer kind.
 * Used by the Ease node's compiled shader output.
 */
export const EASE_WGSL = /* wgsl */ `
fn ease_val(t: f32, kind: i32) -> f32 {
  if (kind == 0) { return t; }
  if (kind == 1) { return t * t; }
  if (kind == 2) { return 1.0 - (1.0 - t) * (1.0 - t); }
  if (kind == 3) { return select(1.0 - 2.0 * (1.0 - t) * (1.0 - t), 2.0 * t * t, t < 0.5); }
  if (kind == 4) { return 1.0 - cos(t * ${Math.PI / 2}); }
  if (kind == 5) { return sin(t * ${Math.PI / 2}); }
  if (kind == 6) { return -(cos(${Math.PI} * t) - 1.0) * 0.5; }
  if (kind == 7) { return t * t * t; }
  if (kind == 8) { return 1.0 - pow(1.0 - t, 3.0); }
  if (kind == 9) { return select(1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5, 4.0 * t * t * t, t < 0.5); }
  if (kind == 10) { return t * t * t * t; }
  if (kind == 11) { return 1.0 - pow(1.0 - t, 4.0); }
  if (kind == 12) { return select(1.0 - pow(-2.0 * t + 2.0, 4.0) * 0.5, 8.0 * t * t * t * t, t < 0.5); }
  if (kind == 13) { return select(0.0, pow(2.0, 10.0 * t - 10.0), t > 0.0); }
  if (kind == 14) { return select(1.0, 1.0 - pow(2.0, -10.0 * t), t < 1.0); }
  if (kind == 15) {
    if (t == 0.0) { return 0.0; }
    if (t == 1.0) { return 1.0; }
    return select((2.0 - pow(2.0, -20.0 * t + 10.0)) * 0.5, pow(2.0, 20.0 * t - 10.0) * 0.5, t < 0.5);
  }
  return t;
}
`;
