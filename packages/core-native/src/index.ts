/**
 * @printsync/core-native - TypeScript bindings for native hot paths
 *
 * This module provides TypeScript bindings for the Rust native module.
 * It uses dynamic import with fallback to pure TypeScript implementations.
 */

// Native module types (loaded via napi-rs)
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoulevardPose {
  position: Vec3;
  lookAt: Vec3;
}

export interface SubjectPose {
  position: Vec3;
  lookAt: Vec3;
}

// Native function signatures
export interface NativeModule {
  fnv1a_64(data: string): bigint;
  fnv1a_32(data: string): number;
  mulberry32(seed: number): () => number;
  frameDistance(visibleWidth: number, fovDeg: number, aspect: number): number;
  boulevardPose(t: number, extent: number, rise: number): BoulevardPose;
  subjectPose(
    faceCenter: Vec3,
    normal: Vec3,
    tangent: Vec3,
    distance: number,
    slide: number,
    lift: number,
    aim: number,
    height: number,
  ): SubjectPose;
  analyzeFrequencyBands(spectrum: Float32Array, bands: number): number[];
  kerbsideClearance(
    subjectZ: number,
    subjectHalfLength: number,
    parkedVehiclesZ: number[],
    parkedHalfLengths: number[],
  ): number;
  liftPanelAboveShop(
    panelBottom: number,
    shopHeight: number,
    panelHeight: number,
    gap: number,
  ): number;
  cityGridPositions(
    extent: number,
    slotSpacing: number,
    buildingWidthRange: [number, number],
  ): number[];
}

// Pure TypeScript fallback implementations
export const fnv1a_64_ts = (data: string): bigint => {
  const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(data)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & 0xffffffffffffffffn;
  }
  return hash;
};

export const fnv1a_32_ts = (data: string): number => {
  const FNV_OFFSET_BASIS = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(data)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
};

export const mulberry32_ts = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    z = (z ^ (z >>> 16)) >>> 0;
    return z / 0x100000000;
  };
};

export const frameDistance_ts = (visibleWidth: number, fovDeg: number, aspect: number): number => {
  const halfFovRad = ((fovDeg * Math.PI) / 180) * 0.5;
  return visibleWidth / (2 * Math.tan(halfFovRad) * aspect);
};

export const boulevardPose_ts = (t: number, extent: number, rise: number) => {
  const x = -5.6;
  const y = 1.72 + rise * 12.28;
  const z = extent * (0.62 - 0.74 * t);
  const yaw = ((1 - rise) * 8.5 * Math.PI) / 180;
  return {
    position: { x, y, z },
    lookAt: { x: x - yaw, y: 1.72 + rise * 12.28, z: z - 42 },
  };
};

export const subjectPose_ts = (
  faceCenter: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  tangent: { x: number; y: number; z: number },
  distance: number,
  slide: number,
  lift: number,
  aim: number,
  height: number,
) => {
  const up = { x: 0, y: 1, z: 0 };
  return {
    position: {
      x: faceCenter.x + normal.x * distance + tangent.x * slide + up.x * lift,
      y: faceCenter.y + normal.y * distance + tangent.y * slide + up.y * lift,
      z: faceCenter.z + normal.z * distance + tangent.z * slide + up.z * lift,
    },
    lookAt: {
      x: faceCenter.x + up.x * (aim * height),
      y: faceCenter.y + up.y * (aim * height),
      z: faceCenter.z + up.z * (aim * height),
    },
  };
};

export const analyzeFrequencyBands_ts = (spectrum: Float32Array, bands: number): number[] => {
  if (bands <= 0 || spectrum.length === 0) return [];
  const bandSize = spectrum.length / bands;
  const result: number[] = [];
  for (let b = 0; b < bands; b++) {
    const start = Math.floor(b * bandSize);
    const end = Math.min(Math.ceil((b + 1) * bandSize), spectrum.length);
    if (start >= end) {
      result.push(0);
      continue;
    }
    let sum = 0;
    for (let i = start; i < end; i++) sum += spectrum[i];
    result.push(sum / (end - start));
  }
  return result;
};

export const kerbsideClearance_ts = (
  subjectZ: number,
  subjectHalfLength: number,
  parkedVehiclesZ: number[],
  parkedHalfLengths: number[],
): number => {
  let minClearance = Infinity;
  for (let i = 0; i < parkedVehiclesZ.length; i++) {
    const clearance =
      Math.abs(subjectZ - parkedVehiclesZ[i]) - subjectHalfLength - parkedHalfLengths[i];
    if (clearance < minClearance) minClearance = clearance;
  }
  return minClearance === Infinity ? 100 : minClearance;
};

export const liftPanelAboveShop_ts = (
  panelBottom: number,
  shopHeight: number,
  panelHeight: number,
  gap: number,
): number => {
  const newCenter = shopHeight + gap + panelHeight * 0.5;
  return newCenter - panelBottom;
};

export const cityGridPositions_ts = (
  extent: number,
  slotSpacing: number,
  buildingWidthRange: [number, number],
): number[] => {
  const positions: number[] = [];
  let z = -extent + slotSpacing * 0.5;
  while (z < extent - slotSpacing * 0.5) {
    positions.push(z);
    z += slotSpacing;
  }
  return positions;
};

// Module loader with fallback
let nativeModule: typeof import('@printsync/core-native') | null = null;
let nativeAvailable = false;

export async function loadNativeModule(): Promise<NativeModule> {
  if (nativeModule) return nativeModule;

  try {
    // Try to load native module
    const mod = await import('@printsync/core-native');
    nativeModule = mod;
    nativeAvailable = true;
    console.log('[core-native] Native module loaded successfully');
    return mod;
  } catch (e) {
    console.warn('[core-native] Native module not available, using TypeScript fallbacks:', e);
    nativeAvailable = false;
    return createFallbackModule();
  }
}

function createFallbackModule(): NativeModule {
  return {
    fnv1a_64: (data: string) => fnv1a_64_ts(data),
    fnv1a_32: (data: string) => fnv1a_32_ts(data),
    mulberry32: (seed: number) => mulberry32_ts(seed),
    frameDistance: (visibleWidth: number, fovDeg: number, aspect: number) =>
      frameDistance_ts(visibleWidth, fovDeg, aspect),
    boulevardPose: (t: number, extent: number, rise: number) => boulevardPose_ts(t, extent, rise),
    subjectPose: (
      faceCenter: { x: number; y: number; z: number },
      normal: { x: number; y: number; z: number },
      tangent: { x: number; y: number; z: number },
      distance: number,
      slide: number,
      lift: number,
      aim: number,
      height: number,
    ) => subjectPose_ts(faceCenter, normal, tangent, distance, slide, lift, aim, height),
    analyzeFrequencyBands: (spectrum: Float32Array, bands: number) =>
      analyzeFrequencyBands_ts(spectrum, bands),
    kerbsideClearance: (
      subjectZ: number,
      subjectHalfLength: number,
      parkedVehiclesZ: number[],
      parkedHalfLengths: number[],
    ) => kerbsideClearance_ts(subjectZ, subjectHalfLength, parkedVehiclesZ, parkedHalfLengths),
    liftPanelAboveShop: (
      panelBottom: number,
      shopHeight: number,
      panelHeight: number,
      gap: number,
    ) => liftPanelAboveShop_ts(panelBottom, shopHeight, panelHeight, gap),
    cityGridPositions: (
      extent: number,
      slotSpacing: number,
      buildingWidthRange: [number, number],
    ) => cityGridPositions_ts(extent, slotSpacing, buildingWidthRange),
  };
}

// Re-export fallbacks for direct use
export {
  analyzeFrequencyBands_ts as analyzeFrequencyBands,
  boulevardPose_ts as boulevardPose,
  cityGridPositions_ts as cityGridPositions,
  fnv1a_32_ts as fnv1a32,
  fnv1a_64_ts as fnv1a64,
  frameDistance_ts as frameDistance,
  kerbsideClearance_ts as kerbsideClearance,
  liftPanelAboveShop_ts as liftPanelAboveShop,
  mulberry32_ts as mulberry32,
  subjectPose_ts as subjectPose,
};

// Utility: check if native module is available
export function isNativeAvailable(): boolean {
  return nativeAvailable;
}

// Export types
export type { BoulevardPose, SubjectPose, Vec3 };
