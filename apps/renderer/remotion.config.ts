import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(4);

/**
 * Headroom for WebGL work during a cold, concurrent render.
 *
 * drei's `<Environment>` builds a PMREM environment map (a cube render target
 * plus a prefilter pass) the first time a page is evaluated. With several
 * headless Chromium tabs booting at once, that first frame can exceed Remotion's
 * 30s default delay-render budget and abort the render with
 * "Timed out evaluating page function". The work is bounded and one-off per
 * page, so we simply allow more time rather than degrade the lighting.
 */
Config.setDelayRenderTimeoutInMilliseconds(120_000);
