import { z } from 'zod';

/**
 * Runtime-validated render inputs for the Remotion renderer. This is the
 * contract the orchestrator (or any backend service) uses to drive a render:
 * which composition, which items, brand tokens, camera path, audio and output.
 */

/** Brand tokens the renderer needs to produce on-brand artwork and chrome. */
export const BrandTokensSchema = z.object({
  wordmark: z.string().min(1),
  tagline: z.string(),
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  paper: z.string(),
  ink: z.string(),
});

export const CameraPathSchema = z.enum(['turntable', 'orbit', 'dolly', 'hero', 'showcase', 'none']);

export const CompositionIdSchema = z.enum([
  'PrintSyncSignatureFilm',
  'PrintSyncProductLine',
  'PrintSyncBrandFilm',
  'PrintSyncLivingCity',
]);

export const TimeOfDaySchema = z.enum(['night', 'dusk', 'day']);

/**
 * Optional living-city overrides. Everything else the city needs is derived
 * from the shared inputs (brand, items, camera path); these steer the
 * procedural street itself.
 */
export const CityInputsSchema = z.object({
  seed: z.string().min(1).default('printsync-city-01'),
  timeOfDay: TimeOfDaySchema.default('night'),
  /** Building / street-furniture density, 0.4 (sparse) .. 2 (dense). */
  density: z.number().positive().default(1),
  route: z.boolean().default(true),
});

export const RenderOutputSchema = z.object({
  format: z.enum(['mp4', 'webm', 'png']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/** Per-item render overrides — which items appear and how they animate. */
export const RenderItemSchema = z.object({
  id: z.string().min(1),
  animation: z
    .enum(['rise', 'float', 'orbit', 'spin', 'reveal', 'fold', 'drop', 'reset'])
    .default('float'),
  phase: z.number().int().nonnegative().default(0),
});

/**
 * The full render-input contract. Everything the renderer needs to produce a
 * deterministic, on-brand film from a backend request.
 */
export const RenderInputsSchema = z.object({
  composition: CompositionIdSchema,
  brand: BrandTokensSchema,
  items: z.array(z.string()).min(1),
  itemAnimations: z.array(RenderItemSchema).default([]),
  cameraPath: CameraPathSchema.default('turntable'),
  /** Living-city steers; ignored by the other compositions. */
  city: CityInputsSchema.optional(),
  audioSrc: z.string().optional(),
  timeline: z
    .object({
      fps: z.number().positive().default(30),
      durationInFrames: z.number().int().positive(),
    })
    .default({ fps: 30, durationInFrames: 450 }),
  output: RenderOutputSchema,
});

export type BrandTokens = z.infer<typeof BrandTokensSchema>;
export type CameraPath = z.infer<typeof CameraPathSchema>;
export type CompositionId = z.infer<typeof CompositionIdSchema>;
export type CityInputs = z.infer<typeof CityInputsSchema>;
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;
export type RenderOutput = z.infer<typeof RenderOutputSchema>;
export type RenderItem = z.infer<typeof RenderItemSchema>;
export type RenderInputs = z.infer<typeof RenderInputsSchema>;

/** Validate unknown data against the render-input contract. */
export function validateRenderInputs(data: unknown): RenderInputs {
  return RenderInputsSchema.parse(data);
}
