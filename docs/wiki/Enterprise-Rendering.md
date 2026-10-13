# Enterprise Rendering

Virtue Studio renders on one machine just fine: `@printsync/renderer` is a Remotion
composition, and the CLI will happily chew through a 1200-frame film locally. This
page is about what happens when one machine is not enough — a campaign that needs
fifty variants by breakfast, or a 4K master with a dozen delivery codecs.

`packages/render-farm` is that answer. It is split into two halves that never need
each other:

| Half | File | Needs AWS? | Needs FFmpeg? |
|---|---|---|---|
| **Planning** — shard a film into jobs | `plan.ts` | no | no |
| **Lambda** — run those jobs on AWS | `lambda.ts` | yes, lazily | no |
| **FFmpeg** — deliver and stitch | `ffmpeg.ts` | no | yes, at run time |

The first and third are pure functions returning `argv` arrays or plain data, so
they are fully unit-tested without either dependency installed. Only `runBinary`
and `createLambdaRenderer` actually touch the outside world.

---

## Planning (`plan.ts`)

A render target is a composition plus its timeline; the planner turns targets into
**jobs**, one per frame range.

```ts
buildRenderPlan({ targets, concurrency }) → RenderPlan
```

```ts
interface RenderTarget {
  composition: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  props?: Record<string, unknown>;
  codec?: 'h264' | 'h265' | 'vp8' | 'vp9' | 'prores' | 'gif';  // default h264
  imageFormat?: 'jpeg' | 'png' | 'webp';                        // default jpeg
  shards?: number;              // how many workers; default 1
  concurrency?: number;         // frames in parallel per worker
}
```

Two decisions are worth knowing:

- **Half-open frame ranges.** `FrameRange` is `{ from, toExclusive }`. Half-open
  ranges compose without off-by-one bugs, and Remotion's *inclusive* `--frames=a-b`
  argument is derived in exactly one place, `frameRangeArg`, at the edge:

  ```ts
  frameRangeArg({ from: 0, toExclusive: 300 }) // → '0-299'
  ```

- **Job ids are the source of truth.** `jobId(composition, range)` is deterministic,
  so a farm can deduplicate, resume and retry by id without a database. The same
  request always produces the same plan, in the same order.

`DEFAULT_FRAMES_PER_SHARD` is 300 frames: roughly ten seconds of 30 fps footage per
worker, which keeps a Lambda invocation comfortably inside its timeout while still
being long enough that the per-invocation overhead disappears.

---

## Lambda (`lambda.ts`)

`@remotion/lambda` is deliberately **not** a hard dependency of this repo, or of any
package in it. AWS is only needed by the person running the farm, so the module is
loaded on demand:

```ts
import { createLambdaRenderer, loadRemotionLambda } from '@printsync/render-farm';

const renderer = createLambdaRenderer({
  region: 'eu-west-2',
  functionName: 'remotion-render-4-0-535-mem2048mb-disk2048mb-120sec',
  serveUrl,          // from deploySite()
  bucketName,
  framesPerLambda: 300,
  concurrency: 12,
});

const { renderId } = await renderer.render(job, 'city.0-299.mp4');
const done = await renderer.wait(renderId);
```

The dynamic import uses a **variable** specifier so the TypeScript compiler never
tries to resolve a module that may not be installed for a local render. If it is
missing, the error says exactly what to run:

```
Remotion Lambda is not installed. Install it where you run the farm:
  pnpm add @remotion/lambda --filter @printsync/render-farm
Then set AWS_REGION (and credentials) before rendering.
```

Progress is normalised across workers into one shape (`FarmRenderProgress`:
`done`, `overallProgress`, `failed`, `outputFile`, `errors`, `cost`), so the caller
branches on one type whether it is polling Lambda or a local process.

---

## Delivery (`ffmpeg.ts`)

Every function here returns the `argv` for a binary; nothing shell-quotes, nothing
concatenates a command line. `runBinary(binary, args)` is the single thin spawner.

| Function | Purpose |
|---|---|
| `ffmpegConcatArgs` | Stitch shards with the concat demuxer |
| `ffmpegMuxArgs` | Mux picture-locked video with its audio bed |
| `ffmpegTranscodeArgs` | Master → delivery codec/profile |
| `ffmpegThumbnailArgs` | Pull a poster frame |
| `ffprobeArgs` / `parseProbe` | Read back duration, dimensions, streams |
| `loudnormFilter` | Build a loudness-normalisation filter string |

Three defaults encode production decisions:

- **Concat is a stream copy by default.** Shards come from the same encoder with
  identical settings, so joining them is lossless and near-instant; `reencode: true`
  is the escape hatch for when they differ.
- **Muxing loudness-matches the audio** to `DEFAULT_LOUDNESS` (−16 LUFS, −1 dBTP,
  7 LU) or `BROADCAST_LOUDNESS` for EBU R128 (−23 LUFS), and always passes
  `-shortest`: the film is the master and a longer audio bed must never extend it.
- **Delivery is H.264 / `yuv420p` / `+faststart`** — the profile that plays
  everywhere and starts streaming before it finishes downloading.

```ts
import { ffmpegMuxArgs, runBinary, BROADCAST_LOUDNESS } from '@printsync/render-farm';

const result = await runBinary('ffmpeg', ffmpegMuxArgs({
  video: 'city.mp4',
  audio: 'score.wav',
  output: 'city-broadcast.mp4',
  loudnorm: BROADCAST_LOUDNESS,
}));
```

---

## Putting it together

A campaign render is a loop over targets, then a fan-out of the plan's jobs:

1. `buildRenderPlan` turns the brief's targets into shard jobs and output plans.
2. Each job goes to a worker — `createLambdaRenderer(...).render(job, name)` on AWS,
   or `remotion render` locally, both driven by the same `frameRangeArg`.
3. The shards for one output are stitched with `ffmpegConcatArgs`.
4. The audio bed is muxed in with `ffmpegMuxArgs` (loudness-matched).
5. Delivery variants come from `ffmpegTranscodeArgs`; hero stills from
   `ffmpegThumbnailArgs`.

Because planning is pure and ids are deterministic, steps 2–5 are resumable: a
failed shard is re-submitted by id, and nothing already finished is re-rendered.

See also: [Motion & Renderer](Motion-and-Renderer) · [Production Pipeline](Production-Pipeline) · [Packages & Engines](Packages-and-Engines)
