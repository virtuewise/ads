// ── The Creative Graph IR ────────────────────────────────────────────────────
// The intermediate representation every creative input compiles into.
//
// A node graph edited by hand, a script that builds one, an AI agent that
// proposes one and a production plan that generates one all produce this same
// document. It is versioned, validated, and independent of any one front end.
//
// See docs/38-NODE-EDITOR-AND-VISUAL-PROGRAMMING.md.

import { z } from 'zod';

/**
 * The schema version of the graph document.
 *
 * Bump this when the shape changes. A reader accepts any version it knows and
 * refuses the ones it does not, rather than guessing.
 */
export const GRAPH_SCHEMA_VERSION = 1;

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  /** The kind of node, e.g. 'mediaSource' or 'blur'. */
  kind: z.string().min(1),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  /** The node's settings: the values its ports default to. */
  params: z.record(z.string(), z.unknown()).default({}),
  /** Custom code, for the node kinds that take some. */
  code: z.string().optional(),
});

export const GraphConnectionSchema = z.object({
  from: z.object({ node: z.string().min(1), port: z.string().min(1) }),
  to: z.object({ node: z.string().min(1), port: z.string().min(1) }),
});

export const CreativeGraphSchema = z.object({
  schemaVersion: z.number().int().positive().default(GRAPH_SCHEMA_VERSION),
  nodes: z.array(GraphNodeSchema),
  connections: z.array(GraphConnectionSchema).default([]),
});

/** A node in the graph. */
export type GraphNode = z.infer<typeof GraphNodeSchema>;

/** A connection between two ports. */
export type GraphConnection = z.infer<typeof GraphConnectionSchema>;

/** The graph document. */
export type CreativeGraph = z.infer<typeof CreativeGraphSchema>;

/** Validate an untrusted graph document. */
export function validateCreativeGraph(data: unknown): CreativeGraph {
  return CreativeGraphSchema.parse(data);
}
