/**
 * Render fan-out planning.
 *
 * A single film is one job on a laptop but many jobs in a render farm: the same
 * composition is split into frame ranges so workers can render in parallel, and
 * a campaign multiplies that by every deliverable and every platform aspect.
 *
 * This module is the deterministic, dependency-free core of that fan-out. It
 * knows nothing about Lambda, FFmpeg, queues or storage — it just answers "which
 * jobs exist, which frames does each own, and how do the pieces reassemble",
 * which is exactly the part worth unit-testing.
 */

/** Video codecs Remotion can emit and FFmpeg can stitch. */
export type RenderCodec = 'h264' | 'h265' | 'vp8' | 'vp9' | 'prores' | 'gif';

/** Still/image formats for poster frames and social cutdowns. */
export type RenderImageFormat = 'jpeg' | 'png' | 'webp';

/**
 * A half-open frame range: `from` is inclusive, `toExclusive` is exclusive. Half
 * open ranges compose without off-by-one bugs, and Remotion's inclusive
 * `--frames=a-b` argument is derived at the edge with `frameRangeArg`.
 */
export interface FrameRange {
  readonly from: number;
  /** Exclusive. */
  readonly toExclusive: number;
}

/** One unit of work a single worker can render on its own. */
export interface RenderJobSpec {
  readonly id: string;
  readonly composition: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly codec: RenderCodec;
  readonly imageFormat: RenderImageFormat;
  readonly frames: FrameRange;
  /** Ceiling on simultaneous frame renders inside this job. */
  readonly concurrency: number;
}

/** Something to render, before it has been sharded. */
export interface RenderTarget {
  readonly composition: string;
  readonly durationInFrames: number;
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  /** Overrides passed through to the composition. */
  readonly props?: Readonly<Record<string, unknown>>;
  /** Defaults to `h264`. */
  readonly codec?: RenderCodec;
  /** Defaults to `jpeg`. */
  readonly imageFormat?: RenderImageFormat;
  /**
   * How many frame ranges to split this target into. Defaults to 1 (render it
   * whole). This is the knob that turns one long film into many workers.
   */
  readonly shards?: number;
  /** Per-job concurrency override. */
  readonly concurrency?: number;
}

/** A finished deliverable, and the jobs that make it up in order. */
export interface RenderOutputPlan {
  readonly composition: string;
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  readonly codec: RenderCodec;
  readonly imageFormat: RenderImageFormat;
  readonly frames: FrameRange;
  readonly jobs: readonly RenderJobSpec[];
}

export interface RenderPlanRequest {
  readonly targets: readonly RenderTarget[];
  /** Default per-job concurrency when a target does not set its own. */
  readonly concurrency?: number;
}

export interface RenderPlan {
  /** Every job, in a stable order: target order, then frame order. */
  readonly jobs: readonly RenderJobSpec[];
  readonly outputs: readonly RenderOutputPlan[];
  readonly totalFrames: number;
  readonly maxParallelJobs: number;
}

/** Default frame budget per worker when sharding a long composition. */
export const DEFAULT_FRAMES_PER_SHARD = 300;

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Split `totalFrames` into `shards` contiguous half-open ranges.
 *
 * Balanced and exhaustive: the ranges cover `[0, totalFrames)` with no gap and
 * no overlap, and their sizes differ by at most one frame — which matters
 * because a farm bills for the slowest worker, so lopsided shards waste money.
 */
export function shardFrames(totalFrames: number, shards: number): FrameRange[] {
  const total = clampInt(totalFrames, 0, Number.MAX_SAFE_INTEGER, 0);
  if (total === 0) return [];
  const count = clampInt(shards, 1, total, 1);
  const base = Math.floor(total / count);
  const remainder = total % count;
  const ranges: FrameRange[] = [];
  let cursor = 0;
  for (let index = 0; index < count; index++) {
    const size = base + (index < remainder ? 1 : 0);
    ranges.push({ from: cursor, toExclusive: cursor + size });
    cursor += size;
  }
  return ranges;
}

/**
 * Split a target into ranges using a frames-per-shard budget, unless the target
 * asked for an explicit shard count.
 */
export function planShards(target: RenderTarget): FrameRange[] {
  if (target.shards !== undefined) {
    return shardFrames(target.durationInFrames, target.shards);
  }
  const perShard = Math.max(1, DEFAULT_FRAMES_PER_SHARD);
  const shards = Math.max(1, Math.ceil(target.durationInFrames / perShard));
  return shardFrames(target.durationInFrames, shards);
}

function jobId(composition: string, range: FrameRange): string {
  return `${composition}--f${range.from}-${range.toExclusive - 1}`;
}

/**
 * The render fan-out for a set of targets. Pure: the same request always
 * produces the same jobs with the same ids, so a farm can deduplicate, resume
 * and retry by id without a database as the source of truth.
 */
export function buildRenderPlan(request: RenderPlanRequest): RenderPlan {
  const defaultConcurrency = clampInt(request.concurrency ?? 1, 1, 64, 1);
  const jobs: RenderJobSpec[] = [];
  const outputs: RenderOutputPlan[] = [];

  for (const target of request.targets) {
    const codec = target.codec ?? 'h264';
    const imageFormat = target.imageFormat ?? 'jpeg';
    const concurrency = clampInt(target.concurrency ?? defaultConcurrency, 1, 64, 1);
    const props = target.props ?? {};
    const ranges = planShards(target);

    const targetJobs = ranges.map<RenderJobSpec>((range) => ({
      id: jobId(target.composition, range),
      composition: target.composition,
      props,
      codec,
      imageFormat,
      frames: range,
      concurrency,
    }));

    jobs.push(...targetJobs);
    outputs.push({
      composition: target.composition,
      fps: target.fps,
      width: target.width,
      height: target.height,
      codec,
      imageFormat,
      frames: { from: 0, toExclusive: target.durationInFrames },
      jobs: targetJobs,
    });
  }

  return {
    jobs,
    outputs,
    totalFrames: request.targets.reduce((sum, target) => sum + target.durationInFrames, 0),
    maxParallelJobs: jobs.length,
  };
}

/**
 * Remotion's inclusive frame argument for a job, e.g. `--frames=0-299`. The
 * conversion from the half-open range happens only here.
 */
export function frameRangeArg(range: FrameRange): string {
  if (range.toExclusive <= range.from) {
    throw new Error(`Empty frame range: ${range.from}..${range.toExclusive}`);
  }
  return `${range.from}-${range.toExclusive - 1}`;
}

/** Output filename for a shard, before the shards are stitched back together. */
export function shardFileName(job: RenderJobSpec, extension: string): string {
  return `${job.composition}.f${job.frames.from}.${extension}`;
}
