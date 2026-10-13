import { z } from "zod";

/**
 * Core shared types used across the Creative Motion OS.
 * Each interface has a corresponding Zod schema for runtime validation.
 */

export interface CreativeBrief {
  id?: string;
  title: string;
  duration: number; // seconds
  mode: string; // e.g. "EXPLAINER", "CORPORATE", "DETECTIVE"
  service: string;
  objective: string;
  voice: string; // e.g. "DIALOGUE", "NARRATION"
  scenes: string[]; // high‑level scene identifiers
}

export const CreativeBriefSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  duration: z.number().positive(),
  mode: z.string(),
  service: z.string(),
  objective: z.string(),
  voice: z.string(),
  scenes: z.array(z.string()),
});

/** Script step – a time‑boxed piece of the script. */
export interface ScriptStep {
  start: number; // seconds
  end: number;   // seconds
  visual: string;
  dialogue?: string;
  sfx?: string;
  text?: string;
  camera?: string;
}

export const ScriptStepSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  visual: z.string(),
  dialogue: z.string().optional(),
  sfx: z.string().optional(),
  text: z.string().optional(),
  camera: z.string().optional(),
});

export interface Script {
  steps: ScriptStep[];
}

export const ScriptSchema = z.object({
  steps: z.array(ScriptStepSchema),
});

/** Storybeat – a single narrative beat in a story outline. */
export interface StoryBeat {
  id: string;
  label: string;
  purpose: 'HOOK' | 'PROBLEM' | 'SOLUTION' | 'PROOF' | 'BENEFIT' | 'CTA' | 'BRAND' | 'EDUCATION';
  durationRatio: number;
  entities: Array<{ name: string; type: string }>;
  visualHint: string;
}

/** Storyboard – a higher level representation of shots. */
export interface StoryOutline {
  beats: StoryBeat[];
  structure: 'THREE_ACT' | 'PROBLEM_SOLUTION' | 'BEFORE_AFTER' | 'DETECTIVE' | 'EDUCATIONAL' | 'HERO_JOURNEY';
  totalBeats: number;
  /** @deprecated Use beats instead. Kept for backward compatibility. */
  outline?: string[];
}

export const StoryBeatSchema = z.object({
  id: z.string(),
  label: z.string(),
  purpose: z.enum(['HOOK', 'PROBLEM', 'SOLUTION', 'PROOF', 'BENEFIT', 'CTA', 'BRAND', 'EDUCATION']),
  durationRatio: z.number().positive(),
  entities: z.array(z.object({ name: z.string(), type: z.string() })),
  visualHint: z.string(),
});

export const StoryOutlineSchema = z.object({
  beats: z.array(StoryBeatSchema),
  structure: z.enum(['THREE_ACT', 'PROBLEM_SOLUTION', 'BEFORE_AFTER', 'DETECTIVE', 'EDUCATIONAL', 'HERO_JOURNEY']),
  totalBeats: z.number().int().positive(),
  outline: z.array(z.string()).optional(),
});
export interface Storyboard {
  shots: Shot[];
}

export const StoryboardSchema = z.object({
  shots: z.lazy(() => ShotSchema).array(),
});

/** Minimal camera specification */
export interface CameraSpec {
  type: string; // e.g. "TRACKING", "STATIC"
  lens?: string; // e.g. "35mm"
  movement?: string; // description of movement
}

export const CameraSpecSchema = z.object({
  type: z.string(),
  lens: z.string().optional(),
  movement: z.string().optional(),
});

/** Shot definition – the atomic production unit. */
export interface Shot {
  id: string;
  start: number; // seconds
  duration: number; // seconds
  purpose: string;
  camera: CameraSpec;
  subject?: string;
  environment?: string;
  action?: string;
  lighting?: string;
  typography?: string;
  vfx?: string;
  transition?: string;
  audio?: string[];
}

export const ShotSchema = z.object({
  id: z.string(),
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  purpose: z.string(),
  camera: CameraSpecSchema,
  subject: z.string().optional(),
  environment: z.string().optional(),
  action: z.string().optional(),
  lighting: z.string().optional(),
  typography: z.string().optional(),
  vfx: z.string().optional(),
  transition: z.string().optional(),
  audio: z.array(z.string()).optional(),
});

export interface AssetRequirement {
  type: string; // "image", "video", "audio", "model", etc.
  url: string;
  description?: string;
}

export const AssetRequirementSchema = z.object({
  type: z.string(),
  url: z.url(),
  description: z.string().optional(),
});

export interface TypographyPlan {
  style: string;
  animations?: string[];
}

export const TypographyPlanSchema = z.object({
  style: z.string(),
  animations: z.array(z.string()).optional(),
});

export interface MotionPlan {
  tracks: string[]; // references to motion tracks defined elsewhere
}

export const MotionPlanSchema = z.object({
  tracks: z.array(z.string()),
});

export interface VFXPlan {
  effects: string[];
}

export const VFXPlanSchema = z.object({
  effects: z.array(z.string()),
});

export interface AudioPlan {
  clips: string[];
}

export const AudioPlanSchema = z.object({
  clips: z.array(z.string()),
});

export interface EditPlan {
  cuts: string[];
}

export const EditPlanSchema = z.object({
  cuts: z.array(z.string()),
});

export interface QAPlan {
  checks: string[];
}

export const QAPlanSchema = z.object({
  checks: z.array(z.string()),
});

export interface OutputSpec {
  format: string; // e.g. "mp4"
  resolution: string; // e.g. "1920x1080"
  bitrate?: string;
}

export const OutputSpecSchema = z.object({
  format: z.string(),
  resolution: z.string(),
  bitrate: z.string().optional(),
});

/** Visual grammar – describes the high‑level storytelling language. */
export interface VisualGrammar {
  name: string;
  description: string;
  sequence: string[]; // ordered list of narrative beats
}

export const VisualGrammarSchema = z.object({
  name: z.string(),
  description: z.string(),
  sequence: z.array(z.string()),
});

/** Scene graph structures for relational visualisation. */
export interface SceneNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export const SceneNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.any()),
});

export interface SceneEdge {
  from: string;
  to: string;
  relation: string;
}

export const SceneEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  relation: z.string(),
});

export interface SceneGraph {
  nodes: SceneNode[];
  edges: SceneEdge[];
}

export const SceneGraphSchema = z.object({
  nodes: z.array(SceneNodeSchema),
  edges: z.array(SceneEdgeSchema),
});

/** The top‑level production plan contract. */
export interface ProductionPlan {
  id: string;
  brief: CreativeBrief;
  script: Script;
  storyboard: Storyboard;
  shots: Shot[];
  assets: AssetRequirement[];
  typography: TypographyPlan;
  motion: MotionPlan;
  vfx: VFXPlan;
  audio: AudioPlan;
  edit: EditPlan;
  qa: QAPlan;
  output: OutputSpec;
  visualGrammar: VisualGrammar;
  sceneGraph: SceneGraph;
  productionStatus: "PLANNING" | "COMPLETE";
}

export const ProductionPlanSchema = z.object({
  id: z.string(),
  brief: CreativeBriefSchema,
  script: ScriptSchema,
  storyboard: StoryboardSchema,
  shots: z.array(ShotSchema),
  assets: z.array(AssetRequirementSchema),
  typography: TypographyPlanSchema,
  motion: MotionPlanSchema,
  vfx: VFXPlanSchema,
  audio: AudioPlanSchema,
  edit: EditPlanSchema,
  qa: QAPlanSchema,
  output: OutputSpecSchema,
  visualGrammar: VisualGrammarSchema,
  sceneGraph: SceneGraphSchema,
  productionStatus: z.enum(["PLANNING", "COMPLETE"]),
});

/** Helper for runtime validation */
export const validateProductionPlan = (data: unknown) =>
  ProductionPlanSchema.parse(data);

// ---- Render-input contract (drives the Remotion renderer) ----

export type {
  BrandTokens,
  CameraPath,
  CompositionId,
  RenderOutput,
  RenderItem,
  RenderInputs,
} from './render-input.js';

export {
  BrandTokensSchema,
  CameraPathSchema,
  CompositionIdSchema,
  RenderOutputSchema,
  RenderInputsSchema,
  RenderItemSchema,
  validateRenderInputs,
} from './render-input.js';
