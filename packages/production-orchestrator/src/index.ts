import { randomUUID } from "node:crypto";
import {
  CreativeBrief,
  ProductionPlan,
  ProductionPlanSchema,
  RenderInputs,
  RenderInputsSchema,
  VisualGrammar,
} from '@printsync/common';
import { PRINT_ITEMS_HERO_ANIMATIONS, PRINT_ITEMS_HERO_IDS } from '@printsync/motion-engine';import { SubjectEngine } from '@printsync/subject-engine';
import { StoryEngine } from '@printsync/story-engine';
import { selectVisualGrammar } from '@printsync/visual-grammar-engine';
import { ScriptEngine } from '@printsync/script-engine';
import { StoryboardEngine } from '@printsync/storyboard-engine';
import { ShotEngine } from '@printsync/shot-engine';
import { SceneGraphEngine } from '@printsync/scene-graph-engine';

/** Options for building a production plan */
export interface OrchestratorOptions {
  /** Optional deterministic seed used by engines that support it */
  seed?: string;
  /** If true, perform full Zod validation and throw on failure */
  validate?: boolean;
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
 * Orchestrates the full production pipeline.
 * Returns a ProductionPlan with `productionStatus` set to "PLANNING".
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

  // 7️⃣ Scene‑graph construction
  const sceneGraphEngine = new SceneGraphEngine();
  const sceneGraph = await sceneGraphEngine.buildGraph(shots);

  // Assemble the plan. Sections that are not yet wired to dedicated engines are
  // populated with deterministic values derived from the brief/shots so the plan
  // always satisfies ProductionPlanSchema (placeholder sections, not empty).
  const plan: ProductionPlan = {
    id: randomUUID(),
    brief,
    script,
    storyboard,
    shots,
    assets: [],
    typography: {
      style: brief.mode.toLowerCase(),
      animations: ['KINETIC_TITLE', 'KINETIC_CTA'],
    },
    motion: {
      tracks: shots.map((s) => `track:${s.id}`),
    },
    vfx: {
      effects: shots.map((s) => s.vfx).filter((v): v is string => Boolean(v)),
    },
    audio: {
      clips: brief.voice ? [`voiceover:${brief.voice.toLowerCase()}`] : [],
    },
    edit: {
      cuts: shots.map((s) => `cut@${Math.round(s.start + s.duration / 2)}s`),
    },
    qa: {
      checks: ['BRAND_QA', 'BRAND_TYPOGRAPHY', 'RESOLUTION', 'CONTENT_REVIEW'],
    },
    output: {
      format: 'mp4',
      resolution: '1920x1080',
      bitrate: '8Mbps',
    },
    visualGrammar,
    sceneGraph,
    productionStatus: "PLANNING",
  };

  if (options.validate !== false) {
    ProductionPlanSchema.parse(plan);
  }

  return plan;
}
