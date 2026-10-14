import { describe, expect, it } from 'vitest';
import {
  BROADCAST_LOUDNESS,
  DEFAULT_LOUDNESS,
  ffmpegConcatArgs,
  ffmpegMuxArgs,
  ffmpegThumbnailArgs,
  ffmpegTranscodeArgs,
  ffprobeArgs,
  loudnormFilter,
  parseProbe,
} from './ffmpeg.js';
import { loadRemotionLambda } from './lambda.js';
import {
  buildRenderPlan,
  DEFAULT_FRAMES_PER_SHARD,
  frameRangeArg,
  planShards,
  type RenderJobSpec,
  type RenderTarget,
  shardFileName,
  shardFrames,
} from './plan.js';

describe('shardFrames', () => {
  it('covers the whole composition with no gap and no overlap', () => {
    for (const total of [1, 7, 1200, 1201, 5000]) {
      for (const shards of [1, 2, 3, 7, 64]) {
        const ranges = shardFrames(total, shards);
        const covered = ranges.reduce((sum, range) => sum + (range.toExclusive - range.from), 0);
        expect(covered).toBe(total);
        expect(ranges[0]?.from).toBe(0);
        expect(ranges[ranges.length - 1]?.toExclusive).toBe(total);
        for (let i = 1; i < ranges.length; i++) {
          expect(ranges[i]?.from).toBe(ranges[i - 1]?.toExclusive);
        }
      }
    }
  });

  it('balances the shards, because a farm bills for the slowest worker', () => {
    const ranges = shardFrames(1200, 7);
    const sizes = ranges.map((range) => range.toExclusive - range.from);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(ranges).toHaveLength(7);
  });

  it('never asks for more shards than frames', () => {
    expect(shardFrames(3, 10)).toHaveLength(3);
  });

  it('returns nothing for an empty composition', () => {
    expect(shardFrames(0, 4)).toEqual([]);
  });
});

describe('planShards', () => {
  const target = (overrides: Partial<RenderTarget>): RenderTarget => ({
    composition: 'PrintSyncLivingCity',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
    ...overrides,
  });

  it('honours an explicit shard count', () => {
    expect(planShards(target({ shards: 5 }))).toHaveLength(5);
  });

  it('uses the default frame budget when no shard count is given', () => {
    const ranges = planShards(target({ durationInFrames: 1200 }));
    expect(ranges).toHaveLength(Math.ceil(1200 / DEFAULT_FRAMES_PER_SHARD));
  });

  it('keeps a short composition as a single job', () => {
    expect(planShards(target({ durationInFrames: 90 }))).toHaveLength(1);
  });
});

describe('buildRenderPlan', () => {
  const targets: RenderTarget[] = [
    {
      composition: 'PrintSyncLivingCity',
      durationInFrames: 1200,
      fps: 30,
      width: 1920,
      height: 1080,
      shards: 4,
      props: { seed: 'launch', timeOfDay: 'night' },
    },
    {
      composition: 'PrintSyncProductLine',
      durationInFrames: 600,
      fps: 30,
      width: 1080,
      height: 1080,
      codec: 'prores',
      imageFormat: 'png',
      shards: 2,
    },
  ];

  it('is deterministic and gives every job a stable, unique id', () => {
    const a = buildRenderPlan({ targets, concurrency: 8 });
    const b = buildRenderPlan({ targets, concurrency: 8 });
    expect(a).toEqual(b);
    const ids = a.jobs.map((job) => job.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.jobs.map((job) => job.id)).toEqual([
      'PrintSyncLivingCity--f0-299',
      'PrintSyncLivingCity--f300-599',
      'PrintSyncLivingCity--f600-899',
      'PrintSyncLivingCity--f900-1199',
      'PrintSyncProductLine--f0-299',
      'PrintSyncProductLine--f300-599',
    ]);
  });

  it('groups each target into an output whose jobs tile its frames exactly', () => {
    const plan = buildRenderPlan({ targets });
    expect(plan.outputs).toHaveLength(2);
    expect(plan.totalFrames).toBe(1800);

    for (const output of plan.outputs) {
      let cursor = 0;
      for (const job of output.jobs) {
        expect(job.frames.from).toBe(cursor);
        cursor = job.frames.toExclusive;
      }
      expect(cursor).toBe(output.frames.toExclusive);
    }
  });

  it('passes props, codec, image format and concurrency through', () => {
    const plan = buildRenderPlan({ targets, concurrency: 8 });
    const first = plan.jobs[0] as RenderJobSpec;
    expect(first.props).toEqual({ seed: 'launch', timeOfDay: 'night' });
    expect(first.codec).toBe('h264');
    expect(first.imageFormat).toBe('jpeg');
    expect(first.concurrency).toBe(8);

    const prores = plan.outputs[1];
    expect(prores?.codec).toBe('prores');
    expect(prores?.imageFormat).toBe('png');
  });

  it('defaults to a single job per short target', () => {
    const plan = buildRenderPlan({
      targets: [
        {
          composition: 'PrintSyncSignatureFilm',
          durationInFrames: 120,
          fps: 30,
          width: 1920,
          height: 1080,
        },
      ],
    });
    expect(plan.jobs).toHaveLength(1);
    expect(plan.jobs[0]?.props).toEqual({});
  });
});

describe('frameRangeArg', () => {
  it("converts the half-open range to Remotion's inclusive argument", () => {
    expect(frameRangeArg({ from: 0, toExclusive: 300 })).toBe('0-299');
    expect(frameRangeArg({ from: 900, toExclusive: 1200 })).toBe('900-1199');
  });

  it('refuses an empty range rather than emitting a silent no-op render', () => {
    expect(() => frameRangeArg({ from: 5, toExclusive: 5 })).toThrow();
  });
});

describe('shardFileName', () => {
  it('names shards so the concat list can be built by sorting', () => {
    const plan = buildRenderPlan({
      targets: [
        {
          composition: 'PrintSyncLivingCity',
          durationInFrames: 1200,
          fps: 30,
          width: 1920,
          height: 1080,
          shards: 4,
        },
      ],
    });
    expect(plan.jobs.map((job) => shardFileName(job, 'mp4'))).toEqual([
      'PrintSyncLivingCity.f0.mp4',
      'PrintSyncLivingCity.f300.mp4',
      'PrintSyncLivingCity.f600.mp4',
      'PrintSyncLivingCity.f900.mp4',
    ]);
  });
});

describe('loudnormFilter', () => {
  it('defaults to the streaming target', () => {
    expect(DEFAULT_LOUDNESS.integratedLufs).toBe(-16);
    expect(loudnormFilter()).toBe('loudnorm=I=-16:TP=-1.5:LRA=11');
  });

  it('supports the broadcast target', () => {
    expect(loudnormFilter(BROADCAST_LOUDNESS)).toBe('loudnorm=I=-23:TP=-2:LRA=7');
  });
});

describe('ffmpeg argument builders', () => {
  it('stream-copies shards by default so the join is lossless', () => {
    expect(ffmpegConcatArgs({ listFile: 'shards.txt', output: 'film.mp4' })).toEqual([
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      'shards.txt',
      '-c',
      'copy',
      'film.mp4',
    ]);
  });

  it('can re-encode when shards do not share an encoding', () => {
    expect(
      ffmpegConcatArgs({ listFile: 'shards.txt', output: 'film.mp4', reencode: true, crf: 18 }),
    ).toContain('libx264');
    expect(
      ffmpegConcatArgs({ listFile: 'shards.txt', output: 'film.mp4', reencode: true, crf: 18 }),
    ).toContain('18');
  });

  it('muxes audio with loudness normalisation and a faststart moov', () => {
    expect(ffmpegMuxArgs({ video: 'v.mp4', audio: 'a.wav', output: 'out.mp4' })).toEqual([
      '-y',
      '-i',
      'v.mp4',
      '-i',
      'a.wav',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-shortest',
      '-movflags',
      '+faststart',
      'out.mp4',
    ]);
  });

  it('leaves audio untouched when normalisation is disabled', () => {
    const args = ffmpegMuxArgs({
      video: 'v.mp4',
      audio: 'a.wav',
      output: 'out.mp4',
      loudnorm: false,
    });
    expect(args).not.toContain('-af');
    expect(args).toContain('out.mp4');
  });

  it('picks the right encoder per delivery codec', () => {
    expect(ffmpegTranscodeArgs({ input: 'm.mov', output: 'd.mp4' })).toEqual([
      '-y',
      '-i',
      'm.mov',
      '-c:v',
      'libx264',
      '-crf',
      '20',
      '-preset',
      'medium',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      'd.mp4',
    ]);
    expect(ffmpegTranscodeArgs({ input: 'm.mov', output: 'd.mp4', codec: 'h265' })).toContain(
      'libx265',
    );
    const prores = ffmpegTranscodeArgs({ input: 'm.mov', output: 'd.mov', codec: 'prores' });
    expect(prores).toContain('prores_ks');
    expect(prores).not.toContain('-crf');
  });

  it('scales poster frames only when a width is asked for', () => {
    expect(ffmpegThumbnailArgs({ input: 'v.mp4', output: 'p.jpg', atSeconds: 8 })).toEqual([
      '-y',
      '-ss',
      '8',
      '-i',
      'v.mp4',
      '-frames:v',
      '1',
      '-q:v',
      '2',
      'p.jpg',
    ]);
    expect(
      ffmpegThumbnailArgs({ input: 'v.mp4', output: 'p.jpg', atSeconds: 8, width: 1280 }),
    ).toContain('scale=1280:-2');
  });

  it('asks ffprobe for machine-readable streams', () => {
    expect(ffprobeArgs('v.mp4')).toEqual([
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      'v.mp4',
    ]);
  });
});

describe('parseProbe', () => {
  const report = JSON.stringify({
    format: { duration: '40.000000', size: '18500000', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
    streams: [
      {
        codec_type: 'video',
        codec_name: 'h264',
        width: 1920,
        height: 1080,
        r_frame_rate: '30/1',
        nb_frames: '1200',
      },
      { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: '48000' },
    ],
  });

  it('reads back the facts a pipeline gates on', () => {
    const probe = parseProbe(report);
    expect(probe.durationSeconds).toBe(40);
    expect(probe.sizeBytes).toBe(18500000);
    expect(probe.video).toEqual({
      codec: 'h264',
      width: 1920,
      height: 1080,
      frameRate: 30,
      frames: 1200,
    });
    expect(probe.audio).toEqual({ codec: 'aac', channels: 2, sampleRate: 48000 });
  });

  it('handles a silent render without inventing an audio track', () => {
    const silent = JSON.stringify({
      format: { duration: '10', size: '100' },
      streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 }],
    });
    const probe = parseProbe(silent);
    expect(probe.audio).toBeUndefined();
    expect(probe.video?.frameRate).toBe(0);
    expect(probe.video?.frames).toBeUndefined();
  });

  it('survives an empty probe', () => {
    const probe = parseProbe('{}');
    expect(probe.video).toBeUndefined();
    expect(probe.durationSeconds).toBe(0);
  });
});

describe('loadRemotionLambda', () => {
  it('either loads the optional SDK or explains exactly how to install it', async () => {
    // The SDK is an optional peer: absent in this repo by design. Whatever the
    // environment, the failure must be actionable rather than "Cannot find module".
    try {
      const lambda = await loadRemotionLambda();
      expect(typeof lambda.renderMediaOnLambda).toBe('function');
      expect(typeof lambda.getRenderProgress).toBe('function');
    } catch (error) {
      expect(String(error)).toContain('pnpm add @remotion/lambda');
    }
  });
});
