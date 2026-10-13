import { randomUUID } from "node:crypto";
import {
  CreativeBrief,
  ProductionPlan,
  ProductionPlanSchema,
  RenderInputs,
  RenderInputsSchema,
  VisualGrammar,
  Shot,
} from '@printsync/common';
import { PRINT_ITEMS_HERO_ANIMATIONS, PRINT_ITEMS_HERO_IDS } from '@printsync/motion-engine';
import { SubjectEngine } from '@printsync/subject-engine';
import { StoryEngine } from '@printsync/story-engine';
import { selectVisualGrammar } from '@printsync/visual-grammar-engine';
import { ScriptEngine } from '@printsync/script-engine';
import { StoryboardEngine } from '@printsync/storyboard-engine';
import { ShotEngine } from '@printsync/shot-engine';
import { SceneGraphEngine } from '@printsync/scene-graph-engine';
import { AssetEngine } from '@printsync/asset-engine';
import { TypographyEngine } from '@printsync/typography-engine';
import { VFXEngine } from '@printsync/vfx-engine';
import { AudioEngine } from '@printsync/audio-engine';
import { EditEngine } from '@printsync/edit-engine';
import { QAEngine } from '@printsync/qa-engine';

/** Options for building a production plan */
export interface OrchestratorOptions {
  /** Optional deterministic seed used by engines that support it */
  seed?: string;
  /** If true, perform full Zod validation and throw on failure */
  validate?: boolean;
  /** QA strictness level */
  qaStrictness?: 'LENIENT' | 'STANDARD' | 'STRICT';
  /** Audio options */
  audio?: { voice?: string; musicStyle?: string };
}

/** Local motion planning engine for production pipeline (not to be confused with the 3D rendering motion-engine) */
class MotionPlanningEngine {
  async planMotion(shots: Shot[], options: { mode?: string; fps?: number } = {}): Promise<{
    tracks: string[];
    templates: string[];
  }> {
    const { mode = 'EXPLAINER' } = options;
    const tracks: string[] = [];

    for (const shot of shots) {
      const trackId = `track:${shot.id}`;
      tracks.push(trackId);
    }

    if (mode.includes('3D') || mode.includes('VFX')) {
      tracks.push('track:global_camera_orbit');
      tracks.push('track:global_light_sweep');
    }
    if (mode.includes('TYPOGRAPHIC') || mode.includes('POSTER')) {
      tracks.push('track:global_typography_reveal');
    }

    return {
      tracks,
      templates: ['CAMERA_PUSH_IN', 'CAMERA_ORBIT', 'OBJECT_REVEAL', 'LIGHT_SWEEP', 'PARTICLE_BURST', 'TYPOGRAPHY_REVEAL'],
    };
  }
}

/**
 * Derive validated render inputs for the Remotion renderer from a creative
 * brief. This bridges the production pipeline to the render engine — the
 * renderer consumes exactly what this function produces.
 *
 * The hero set and its choreography are owned by `@printsync/motion-engine`, so
 * this function only supplies the *brief-derived* decisions (brand, camera
 * path, timeline, output) and can never drift from what the renderer models.
 */
export function buildRenderInputs(brief: CreativeBrief): RenderInputs {
  return RenderInputsSchema.parse({
    composition: 'PrintSyncProductLine',
    brand: {
      wordmark: 'PRINTSYNC',
      tagline: brief.objective || 'Your Vision. Our Precision.',
      primary: '#C8001C',
      secondary: '#373435',
      accent: '#00A8E0',
      paper: '#F5F1EA',
      ink: '#141414',
    },
    items: [...PRINT_ITEMS_HERO_IDS],
    itemAnimations: PRINT_ITEMS_HERO_IDS.map((id, index) => ({
      id,
      animation: PRINT_ITEMS_HERO_ANIMATIONS[index] ?? 'float',
      phase: index * 7,
    })),
    cameraPath: 'turntable',
    timeline: { fps: 30, durationInFrames: 450 },
    output: { format: 'mp4', width: 1920, height: 1080 },
  });
}

/**
 * Derive validated render inputs for the **living-city** film.
 *
 * Same contract as `buildRenderInputs`, but it targets `PrintSyncLivingCity` and
 * supplies the city steers (a deterministic seed derived from the brief, time of
 * day, density and the animated route). The street itself is generated inside
 * the renderer from these values, so nothing about the layout is hard-coded here.
 */
export function buildCityRenderInputs(
  brief: CreativeBrief,
  options: { seed?: string; timeOfDay?: 'night' | 'dusk' | 'day' } = {},
): RenderInputs {
  return RenderInputsSchema.parse({
    composition: 'PrintSyncLivingCity',
    brand: {
      wordmark: 'PRINTSYNC',
      tagline: brief.objective || 'Every surface, printed to spec.',
      primary: '#C8001C',
      secondary: '#373435',
      accent: '#00A8E0',
      paper: '#F5F1EA',
      ink: '#141414',
    },
    items: [...PRINT_ITEMS_HERO_IDS],
    cameraPath: 'showcase',
    city: {
      seed: options.seed ?? brief.id ?? 'printsync-city-01',
      timeOfDay: options.timeOfDay ?? 'night',
      density: 1,
      route: true,
    },
    timeline: { fps: 30, durationInFrames: 1200 },
    output: { format: 'mp4', width: 1920, height: 1080 },
  });
}

/**
 * Orchestrates the full production pipeline.
 * Returns a ProductionPlan with all sections populated and `productionStatus` set to "COMPLETE".
 */
export async function buildProductionPlan(
  brief: CreativeBrief,
  options: OrchestratorOptions = {}
): Promise<ProductionPlan> {
  const seed = options.seed ?? brief.id ?? randomUUID();

  // 1️⃣ Subject analysis
  const subjectEngine = new SubjectEngine();
  const subjectInfo = await subjectEngine.analyze(brief);

  // 2️⃣ Story planning
  const storyEngine = new StoryEngine();
  const storyOutline = await storyEngine.planStory(subjectInfo);

  // 3️⃣ Visual grammar selection
  const visualGrammar: VisualGrammar = selectVisualGrammar(brief);

  // 4️⃣ Script generation
  const scriptEngine = new ScriptEngine();
  const script = await scriptEngine.generateScript({
    brief,
    subjectInfo,
    storyOutline,
    visualGrammar,
    seed,
  });

  // 5️⃣ Storyboard generation
  const storyboardEngine = new StoryboardEngine();
  const storyboard = await storyboardEngine.generateStoryboard(script);

  // 6️⃣ Shot planning
  const shotEngine = new ShotEngine();
  const shots = await shotEngine.planShots({
    storyboard,
    briefDuration: brief.duration,
  });

  // 7️⃣ Scene-graph construction
  const sceneGraphEngine = new SceneGraphEngine();
  const sceneGraph = await sceneGraphEngine.buildGraph(shots);

  // 8️⃣ Asset requirements
  const assetEngine = new AssetEngine();
  const assets = await assetEngine.analyzeAssets(shots, {
    includeBrand: true,
    include3D: brief.mode.includes('3D') || brief.mode.includes('VFX'),
    includeStock: !brief.mode.includes('TYPOGRAPHIC') && !brief.mode.includes('POSTER'),
  });

  // 9️⃣ Typography plan
  const typographyEngine = new TypographyEngine();
  const typography = await typographyEngine.planTypography(shots, {
    mode: brief.mode,
    brandPrimary: '#C8001C',
    brandAccent: '#00A8E0',
  });

  // 🔟 Motion planning
  const motionPlanningEngine = new MotionPlanningEngine();
  const motion = await motionPlanningEngine.planMotion(shots, {
    mode: brief.mode,
    fps: 30,
  });

  // 1️⃣1️⃣ VFX planning
  const vfxEngine = new VFXEngine();
  const vfx = await vfxEngine.planVFX(shots, {
    mode: brief.mode,
    budget: brief.duration > 60 ? 'HIGH' : brief.duration > 30 ? 'MEDIUM' : 'LOW',
  });

  // 1️⃣2️⃣ Audio planning
  const audioEngine = new AudioEngine();
  const audio = await audioEngine.planAudio(shots, {
    mode: brief.mode,
    voice: brief.voice,
    musicStyle: brief.mode.includes('CINEMATIC') ? 'CINEMATIC' : undefined,
  });

  // 1️⃣3️⃣ Edit planning
  const editEngine = new EditEngine();
  const edit = await editEngine.planEdit(shots, {
    mode: brief.mode,
    pace: brief.mode.includes('FAST') || brief.mode.includes('SOCIAL') ? 'FAST' :
          brief.mode.includes('CINEMATIC') || brief.mode.includes('BRAND') ? 'SLOW' : 'MEDIUM',
  });

  // 1️⃣4️⃣ QA planning
  const qaEngine = new QAEngine();
  const qa = await qaEngine.planQA(shots, {
    mode: brief.mode,
    strictness: 'STANDARD',
  });

  // Assemble the complete plan with all sections populated
  const plan: ProductionPlan = {
    id: randomUUID(),
    brief,
    script,
    storyboard,
    shots,
    assets,
    typography,
    motion,
    vfx,
    audio,
    edit,
    qa,
    output: {
      format: 'mp4',
      resolution: '1920x1080',
      bitrate: '8Mbps',
    },
    visualGrammar,
    sceneGraph,
    productionStatus: "COMPLETE",
  };

  if (options.validate !== false) {
    ProductionPlanSchema.parse(plan);
  }

  return plan;
}

/**
 * Run automated QA checks against a completed render.
 */
export async function runQA(
  plan: ProductionPlan,
  renderOutput: { format: string; width: number; height: number; bitrate: number; codec: string; duration: number }
) {
  const qaEngine = new QAEngine();
  return qaEngine.runAutomatedChecks(renderOutput, plan.qa.checks);
}

export default { buildProductionPlan, buildRenderInputs, buildCityRenderInputs, runQA };