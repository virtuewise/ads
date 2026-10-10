import { v4 as uuidv4 } from 'uuid';
import { CreativeBrief, ProductionPlan, ProductionPlanSchema, VisualGrammar } from '@printsync/common';
import { SubjectEngine } from '@printsync/subject-engine';
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
 * Orchestrates the full production pipeline.
 * Returns a ProductionPlan with `productionStatus` set to "PLANNING".
 */
export async function buildProductionPlan(
  brief: CreativeBrief,
  options: OrchestratorOptions = {}
): Promise<ProductionPlan> {
  const seed = options.seed ?? brief.id ?? uuidv4();

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

  // Assemble the plan (assets and other sections remain empty for now)
  const plan: ProductionPlan = {
    id: uuidv4(),
    brief,
    script,
    storyboard,
    shots,
    assets: [],
    typography: undefined,
    motion: undefined,
    vfx: undefined,
    audio: undefined,
    edit: undefined,
    qa: undefined,
    output: undefined,
    visualGrammar,
    sceneGraph,
    productionStatus: "PLANNING",
  };

  if (options.validate !== false) {
    ProductionPlanSchema.parse(plan);
  }

  return plan;
}
