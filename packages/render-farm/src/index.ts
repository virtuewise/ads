/**
 * @printsync/render-farm
 * Enterprise render fan-out for Virtue Studio.
 *
 * One film is one job on a laptop; a campaign is thousands. This package is the
 * seam between a render plan and the machinery that executes it at scale:
 *
 * - `plan`   — deterministic fan-out: shard a composition into frame ranges,
 *              group jobs per deliverable, derive stable job ids. Pure, offline,
 *              and the source of truth for resume/retry.
 * - `lambda` — Remotion Lambda adapter for the fan-out (lazily loaded, so AWS is
 *              only required when you actually render on AWS).
 * - `ffmpeg` — stitching and finishing: concat shards, mux the audio bed,
 *              normalise loudness, pull poster frames. Argument builders are
 *              pure; the runners shell out to the binaries.
 *
 * Nothing here renders anything by itself, which is what keeps it testable and
 * keeps a laptop render and a farm render on exactly the same plan.
 */

export * from './ffmpeg.js';
export * from './lambda.js';
export * from './plan.js';
