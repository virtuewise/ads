/**
 * Remotion Lambda adapter.
 *
 * The enterprise path is not "render on a bigger laptop" — it is fan the same
 * job out over AWS Lambda, then stitch the parts with FFmpeg. This module is the
 * thin, typed seam between our render plan and Remotion's Lambda SDK.
 *
 * `@remotion/lambda` is deliberately **not** a dependency. It pulls in the AWS
 * SDK and is only meaningful once you have AWS credentials, so it is loaded
 * lazily and its absence produces an actionable error rather than an install
 * failure for everyone who never touches the farm.
 */

import { frameRangeArg, type RenderJobSpec } from './plan.js';

/** The slice of `@remotion/lambda` this adapter uses. */
export interface RemotionLambdaModule {
  renderMediaOnLambda: (options: LambdaRenderOptions) => Promise<{ renderId: string; bucketName: string }>;
  getRenderProgress: (options: LambdaProgressOptions) => Promise<LambdaProgress>;
  getOrCreateBucket: (options: { region: string }) => Promise<{ bucketName: string }>;
  deploySite: (options: {
    entryPoint: string;
    region: string;
    siteName: string;
    bucketName?: string;
  }) => Promise<{ serveUrl: string; siteName: string }>;
  getFunctions: (options: { region: string; compatibleOnly: boolean }) => Promise<unknown[]>;
}

export interface LambdaRenderOptions {
  region: string;
  functionName: string;
  serveUrl: string;
  composition: string;
  inputProps: Readonly<Record<string, unknown>>;
  codec: string;
  imageFormat: string;
  /** Inclusive Remotion frame argument, e.g. `0-299`. */
  framesPerLambda: number;
  frames: string;
  privacy: 'public' | 'private';
  concurrency: number;
  maxRetries: number;
  outName: string;
  downloadBehavior?: { type: 'download' | 'playback'; fileName?: string };
}

export interface LambdaProgressOptions {
  region: string;
  functionName: string;
  renderId: string;
  bucketName: string;
}

/** Progress report, flattened to the fields a caller actually branches on. */
export interface LambdaProgress {
  done: boolean;
  overallProgress: number;
  fatalErrorEncountered: boolean;
  outputFile?: string;
  errors: readonly { message: string }[];
  costs?: { accruedSoFar: number; currency: string };
}

export interface LambdaRenderConfig {
  region: string;
  /** Fully-framed Lambda function name, e.g. `remotion-render-4-0-535-mem2048mb-disk2048mb-120sec`. */
  functionName: string;
  /** `serveUrl` from `deploySite()`. */
  serveUrl: string;
  bucketName: string;
  /** Frames each Lambda invocation renders. */
  framesPerLambda?: number;
  /** Parallel Lambda invocations. */
  concurrency?: number;
  maxRetries?: number;
  privacy?: 'public' | 'private';
}

/** Progress report from a farm render, normalised across workers. */
export interface FarmRenderProgress {
  readonly renderId: string;
  readonly done: boolean;
  readonly overallProgress: number;
  readonly failed: boolean;
  readonly outputFile: string | undefined;
  readonly errors: readonly string[];
  readonly cost: number | undefined;
}

/** Where to cache the loaded module so repeated calls do not re-import. */
let lambdaModule: RemotionLambdaModule | undefined;

/**
 * Import `@remotion/lambda` on demand. Throws a message that says exactly what
 * to run when it is missing, instead of a bare "Cannot find module".
 */
export async function loadRemotionLambda(): Promise<RemotionLambdaModule> {
  if (lambdaModule) return lambdaModule;
  const specifier = '@remotion/lambda';
  try {
    const loaded = (await import(/* @vite-ignore */ specifier)) as unknown as RemotionLambdaModule;
    lambdaModule = loaded;
    return loaded;
  } catch {
    throw new Error(
      'Remotion Lambda is not installed. Install it where you run the farm:\n' +
        '  pnpm add @remotion/lambda --filter @printsync/render-farm\n' +
        'Then set AWS_REGION (and credentials) before rendering.',
    );
  }
}

/** A renderer that can submit a plan's jobs to Lambda and poll them. */
export interface LambdaRenderer {
  /** Submit one shard job. Returns Remotion's render id. */
  render: (job: RenderJobSpec, outputName: string) => Promise<{ renderId: string; bucketName: string }>;
  /** Poll one render. */
  progress: (renderId: string) => Promise<FarmRenderProgress>;
  /** Wait for a render to finish, polling at `intervalMs`. */
  wait: (renderId: string, options?: { intervalMs?: number; timeoutMs?: number }) => Promise<FarmRenderProgress>;
}

function toProgress(renderId: string, report: LambdaProgress): FarmRenderProgress {
  return {
    renderId,
    done: report.done,
    overallProgress: report.overallProgress,
    failed: report.fatalErrorEncountered,
    outputFile: report.outputFile,
    errors: report.errors.map((error) => error.message),
    cost: report.costs?.accruedSoFar,
  };
}

/**
 * Build a Lambda renderer from configuration. Every call into the SDK goes
 * through `loadRemotionLambda()`, so importing this module never requires AWS.
 */
export function createLambdaRenderer(config: LambdaRenderConfig): LambdaRenderer {
  const base = {
    region: config.region,
    functionName: config.functionName,
    bucketName: config.bucketName,
  };
  const framesPerLambda = config.framesPerLambda ?? 300;
  const concurrency = config.concurrency ?? 4;
  const maxRetries = config.maxRetries ?? 1;
  const privacy = config.privacy ?? 'private';

  return {
    async render(job, outputName) {
      const lambda = await loadRemotionLambda();
      return lambda.renderMediaOnLambda({
        ...base,
        serveUrl: config.serveUrl,
        composition: job.composition,
        inputProps: job.props,
        codec: job.codec,
        imageFormat: job.imageFormat,
        // Remotion treats `framesPerLambda` as the worker's frame budget and
        // `frames` as the slice this render owns; our plan supplies the slice.
        framesPerLambda,
        frames: frameRangeArg(job.frames),
        concurrency,
        maxRetries,
        privacy,
        outName: outputName,
      });
    },

    async progress(renderId) {
      const lambda = await loadRemotionLambda();
      const report = await lambda.getRenderProgress({ ...base, renderId });
      return toProgress(renderId, report);
    },

    async wait(renderId, options) {
      const intervalMs = options?.intervalMs ?? 5000;
      const timeoutMs = options?.timeoutMs ?? 3 * 60 * 60 * 1000;
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const progress = await this.progress(renderId);
        if (progress.done || progress.failed) return progress;
        if (Date.now() > deadline) {
          throw new Error(
            `Timed out waiting for Lambda render ${renderId} after ${timeoutMs}ms ` +
              `(progress ${Math.round(progress.overallProgress * 100)}%).`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    },
  };
}

/**
 * Deploy the renderer's Remotion bundle to a Lambda-backed S3 site, returning
 * the `serveUrl` a renderer needs. Idempotent by site name: Remotion overwrites
 * the existing site rather than creating a new one.
 */
export async function deployRenderSite(options: {
  entryPoint: string;
  region: string;
  siteName: string;
}): Promise<{ serveUrl: string; siteName: string }> {
  const lambda = await loadRemotionLambda();
  const { bucketName } = await lambda.getOrCreateBucket({ region: options.region });
  return lambda.deploySite({
    entryPoint: options.entryPoint,
    region: options.region,
    siteName: options.siteName,
    bucketName,
  });
}
