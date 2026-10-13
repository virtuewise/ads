import { describe, it, expect } from 'vitest';
import {
  CAMERA_PATHS,
  SHOWCASE_SHOTS,
  clamp01,
  resolveCameraPlan,
  resolveCityCameraPlan,
  type CameraPath,
  type CityShotSubject,
} from './camera.js';
import { CITY_LANES, VEHICLE_SIZES } from './vehicles.js';

const RADIUS = 3.1;

describe('CAMERA_PATHS', () => {
  it('matches the render-input contract vocabulary', () => {
    expect([...CAMERA_PATHS]).toEqual([
      'turntable',
      'orbit',
      'dolly',
      'hero',
      'showcase',
      'none',
    ]);
  });

  it('has no duplicates', () => {
    expect(new Set(CAMERA_PATHS).size).toBe(CAMERA_PATHS.length);
  });
});

describe('clamp01', () => {
  it('clamps out-of-range and non-finite values', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('resolveCameraPlan', () => {
  it('supports every declared camera path', () => {
    for (const path of CAMERA_PATHS) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const plan = resolveCameraPlan(path, progress, RADIUS);
        expect(plan.pose.position).toHaveLength(3);
        expect(plan.pose.lookAt).toHaveLength(3);
        expect(plan.pose.position.every(Number.isFinite)).toBe(true);
        expect(plan.worldSpin).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('clamps progress outside [0, 1]', () => {
    const before = resolveCameraPlan('turntable', -5, RADIUS);
    const after = resolveCameraPlan('turntable', 42, RADIUS);
    expect(before.pose.position).toEqual(resolveCameraPlan('turntable', 0, RADIUS).pose.position);
    expect(after.pose.position).toEqual(resolveCameraPlan('turntable', 1, RADIUS).pose.position);
  });

  it('keeps the camera outside the catalogue ring', () => {
    for (const path of CAMERA_PATHS) {
      for (const progress of [0, 0.3, 0.6, 1]) {
        const { pose } = resolveCameraPlan(path, progress, RADIUS);
        const horizontal = Math.hypot(pose.position[0], pose.position[2]);
        expect(horizontal).toBeGreaterThan(RADIUS);
      }
    }
  });

  it('keeps the camera above the floor', () => {
    for (const path of CAMERA_PATHS) {
      const { pose } = resolveCameraPlan(path, 0.5, RADIUS);
      expect(pose.position[1]).toBeGreaterThan(0);
    }
  });

  it('orbits a full revolution for the turntable path', () => {
    const start = resolveCameraPlan('turntable', 0, RADIUS).pose.position;
    const mid = resolveCameraPlan('turntable', 0.5, RADIUS).pose.position;
    const end = resolveCameraPlan('turntable', 1, RADIUS).pose.position;
    expect(mid[0]).toBeCloseTo(-start[0], 12);
    expect(mid[2]).toBeCloseTo(-start[2], 12);
    expect(end[0]).toBeCloseTo(start[0], 12);
    expect(end[2]).toBeCloseTo(start[2], 12);
  });

  it('holds a fixed vantage for the hero path while still drifting slightly', () => {
    const start = resolveCameraPlan('hero', 0, RADIUS).pose.position;
    const end = resolveCameraPlan('hero', 1, RADIUS).pose.position;
    expect(start[0]).toBeCloseTo(end[0], 12);
    expect(start[2]).toBeCloseTo(end[2], 12);
  });

  it('dollies inward as the film progresses', () => {
    const distanceAt = (p: number) => {
      const { pose } = resolveCameraPlan('dolly', p, RADIUS);
      return Math.hypot(pose.position[0], pose.position[2]);
    };
    expect(distanceAt(0)).toBeGreaterThan(distanceAt(0.5));
    expect(distanceAt(0.5)).toBeGreaterThan(distanceAt(1));
  });

  it('drops the world turntable spin whenever the camera already orbits', () => {
    const spins: Record<CameraPath, number> = {
      turntable: 1,
      orbit: 0.35,
      dolly: 0.85,
      hero: 0.15,
      showcase: 0.85,
      none: 0,
    };
    for (const [path, expected] of Object.entries(spins) as [
      CameraPath,
      number,
    ][]) {
      expect(resolveCameraPlan(path, 0.5, RADIUS).worldSpin).toBe(expected);
    }
  });

  it('scales the framing with the layout radius', () => {
    const small = resolveCameraPlan('hero', 0, 1).pose.position;
    const large = resolveCameraPlan('hero', 0, 10).pose.position;
    expect(Math.hypot(large[0], large[2])).toBeGreaterThan(Math.hypot(small[0], small[2]));
  });
});

describe('resolveCityCameraPlan', () => {
  const EXTENT = 120;

  it('supports every contract camera path at city scale', () => {
    for (const path of CAMERA_PATHS) {
      for (const progress of [0, 0.5, 1]) {
        const plan = resolveCityCameraPlan(path, progress, EXTENT);
        expect(plan.pose.position.every(Number.isFinite)).toBe(true);
        expect(plan.pose.lookAt.every(Number.isFinite)).toBe(true);
        // The city does not spin; the camera does all the work.
        expect(plan.worldSpin).toBe(0);
      }
    }
  });

  it('never orbits the world at city scale', () => {
    for (const path of CAMERA_PATHS) {
      expect(resolveCityCameraPlan(path, 0.4, EXTENT).worldSpin).toBe(0);
    }
  });

  it('clamps progress outside [0, 1]', () => {
    const before = resolveCityCameraPlan('dolly', -2, EXTENT).pose.position;
    const after = resolveCityCameraPlan('dolly', 5, EXTENT).pose.position;
    expect(before).toEqual(resolveCityCameraPlan('dolly', 0, EXTENT).pose.position);
    expect(after).toEqual(resolveCityCameraPlan('dolly', 1, EXTENT).pose.position);
  });

  it('travels down the boulevard for the dolly path', () => {
    const start = resolveCityCameraPlan('dolly', 0, EXTENT).pose.position;
    const end = resolveCityCameraPlan('dolly', 1, EXTENT).pose.position;
    expect(end[2]).toBeLessThan(start[2]);
    expect(end[1]).toBeGreaterThan(start[1]);
  });

  it('starts the dolly at driver eye height, to showcase the shopfronts', () => {
    const y = resolveCityCameraPlan('dolly', 0, EXTENT).pose.position[1];
    expect(y).toBeGreaterThan(1.5);
    expect(y).toBeLessThan(2.2);
  });

  it('rides the lane divider for the dolly pass, so no vehicle can clip the lens', () => {
    const x = resolveCityCameraPlan('dolly', 0, EXTENT).pose.position[0];
    // The lanes travelling the same way as the camera: on the left, heading -Z.
    const left = CITY_LANES.filter((lane) => lane.direction === -1).map((lane) => lane.offset);
    expect(left).toHaveLength(2);
    const divider = (Math.min(...left) + Math.max(...left)) / 2;
    expect(x).toBeCloseTo(divider, 5);
    // Clearance to the nearest lane centre beats half the widest vehicle's width.
    const widest = Math.max(...Object.values(VEHICLE_SIZES).map((size) => size.width));
    for (const offset of left) {
      expect(Math.abs(x - offset)).toBeGreaterThan(widest / 2);
    }
  });

  it('keeps the street-level camera above the ground', () => {
    for (const path of CAMERA_PATHS) {
      const { pose } = resolveCityCameraPlan(path, 0.5, EXTENT);
      expect(pose.position[1]).toBeGreaterThan(1);
    }
  });

  it('orbits the whole city when turntabling', () => {
    const start = resolveCityCameraPlan('turntable', 0, EXTENT).pose.position;
    const mid = resolveCityCameraPlan('turntable', 0.5, EXTENT).pose.position;
    expect(mid[0]).toBeCloseTo(-start[0], 10);
    expect(mid[2]).toBeCloseTo(-start[2], 10);
  });

  it('frames a wider orbit for turntable than for orbit', () => {
    const turntable = resolveCityCameraPlan('turntable', 0.25, EXTENT).pose.position;
    const orbit = resolveCityCameraPlan('orbit', 0.25, EXTENT).pose.position;
    expect(Math.hypot(turntable[0], turntable[2])).toBeGreaterThan(
      Math.hypot(orbit[0], orbit[2]),
    );
  });

  it('scales the framing with the city extent', () => {
    const small = resolveCityCameraPlan('hero', 0, 20).pose.position;
    const large = resolveCityCameraPlan('hero', 0, 200).pose.position;
    expect(large[2]).toBeGreaterThan(small[2]);
  });

  it('guards against a degenerate extent', () => {
    const plan = resolveCityCameraPlan('turntable', 0.5, 0);
    expect(plan.pose.position.every(Number.isFinite)).toBe(true);
  });
});

describe('showcase edit', () => {
  const EXTENT = 120;

  // One shot's worth of printed faces, shaped exactly like the resolved city's.
  const SUBJECTS: readonly CityShotSubject[] = [
    {
      kind: 'shopfront',
      position: [-16, 2.2, 32],
      size: [13, 4.4],
      facing: Math.PI / 2,
    },
    {
      kind: 'billboard',
      position: [-14.6, 2.24, -24],
      size: [1.62, 2.88],
      facing: Math.PI / 2,
    },
    {
      kind: 'sign',
      position: [12.9, 1.875, 60],
      size: [0.75, 0.75],
      facing: -Math.PI / 2,
    },
  ];

  function shotFor(kind: CityShotSubject['kind']) {
    const shot = SHOWCASE_SHOTS.find((entry) => entry.kind === kind);
    if (!shot) throw new Error(`showcase has no ${kind} shot`);
    return shot;
  }

  function poseAt(p: number) {
    return resolveCityCameraPlan('showcase', p, EXTENT, SUBJECTS).pose;
  }

  it('covers the film with contiguous cuts', () => {
    const first = SHOWCASE_SHOTS[0];
    const last = SHOWCASE_SHOTS[SHOWCASE_SHOTS.length - 1];
    expect(first?.from).toBe(0);
    expect(last?.to).toBe(1);
    for (let i = 1; i < SHOWCASE_SHOTS.length; i += 1) {
      expect(SHOWCASE_SHOTS[i]?.from).toBe(SHOWCASE_SHOTS[i - 1]?.to);
    }
  });

  it('cuts to every subject kind in turn', () => {
    for (const subject of SUBJECTS) {
      expect(SHOWCASE_SHOTS.some((entry) => entry.kind === subject.kind)).toBe(true);
    }
  });

  it('opens the film the way the dolly pass does', () => {
    expect(poseAt(0)).toEqual(resolveCityCameraPlan('dolly', 0, EXTENT).pose);
  });

  it('throws a hard cut between shots', () => {
    const before = poseAt(0.3 - 1e-6).position;
    const after = poseAt(0.3).position;
    expect(Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]))
      .toBeGreaterThan(1);
  });

  it('squares up to each face and aims within it', () => {
    for (const subject of SUBJECTS) {
      const shot = shotFor(subject.kind);
      const pose = poseAt((shot.from + shot.to) / 2);
      // The lens is aimed dead on the face, so the composition lands on the
      // printed artwork rather than drifting off it.
      expect(pose.lookAt[0]).toBeCloseTo(subject.position[0], 9);
      expect(pose.lookAt[2]).toBeCloseTo(subject.position[2], 9);
      expect(Math.abs(pose.lookAt[1] - subject.position[1])).toBeLessThanOrEqual(
        subject.size[1] / 2 + 1e-9,
      );
      // and sits out on the street side of it, along the face normal.
      const nx = Math.sin(subject.facing);
      const nz = Math.cos(subject.facing);
      const along =
        (pose.position[0] - subject.position[0]) * nx +
        (pose.position[2] - subject.position[2]) * nz;
      expect(along).toBeGreaterThan(0);
    }
  });

  it('pushes in on every subject', () => {
    for (const subject of SUBJECTS) {
      const shot = shotFor(subject.kind);
      const span = shot.to - shot.from;
      const distanceAt = (t: number) => {
        const pose = poseAt(shot.from + span * t);
        return Math.hypot(
          pose.position[0] - subject.position[0],
          pose.position[2] - subject.position[2],
        );
      };
      // The end of a shot is the next shot's start, so sample just inside it.
      expect(distanceAt(1 - 1e-9)).toBeLessThan(distanceAt(0));
    }
  });

  it('keeps every face-on lens clear of the traffic lanes', () => {
    const widest = Math.max(...Object.values(VEHICLE_SIZES).map((size) => size.width));
    const tallest = Math.max(...Object.values(VEHICLE_SIZES).map((size) => size.height));
    for (const subject of SUBJECTS) {
      const shot = shotFor(subject.kind);
      const span = shot.to - shot.from;
      for (let step = 0; step <= 10; step += 1) {
        const pose = poseAt(shot.from + span * (step / 10));
        for (const lane of CITY_LANES) {
          const lateral = Math.abs(pose.position[0] - lane.offset);
          const clear = lateral > widest / 2 + 0.2 || pose.position[1] > tallest + 0.2;
          expect(clear).toBe(true);
        }
      }
    }
  });

  it('rises off the street for the closing skyline shot', () => {
    const start = poseAt(0.84).position;
    const end = poseAt(1).position;
    expect(end[1]).toBeGreaterThan(start[1]);
    expect(end[1]).toBeGreaterThan(20);
  });

  it('falls back to the travelling pass when there is nothing to cut to', () => {
    for (const progress of [0.35, 0.6, 0.75, 0.9]) {
      const pose = resolveCityCameraPlan('showcase', progress, EXTENT, []).pose;
      expect(pose.position.every(Number.isFinite)).toBe(true);
      expect(pose.lookAt.every(Number.isFinite)).toBe(true);
    }
  });
});
