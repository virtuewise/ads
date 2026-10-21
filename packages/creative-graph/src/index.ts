// ── Creative Graph ──────────────────────────────────────────────────────────
// The shared intermediate representation for creative work: one versioned,
// validated document that a node graph, a script, an AI agent and a production
// plan all compile into.
//
// See docs/38-NODE-EDITOR-AND-VISUAL-PROGRAMMING.md.

export {
  analyzeGraph,
  createsCycle,
  type GraphAnalysis,
  type GraphIssue,
  type NodeCatalog,
  type NodeKindInfo,
  topologicalOrder,
} from './analyze';
export {
  type CreativeGraph,
  CreativeGraphSchema,
  GRAPH_SCHEMA_VERSION,
  type GraphConnection,
  GraphConnectionSchema,
  type GraphNode,
  GraphNodeSchema,
  validateCreativeGraph,
} from './graph';
export {
  compilePlan,
  type PlanCompilation,
  type TimelineItem,
} from './plan';
export {
  canConnect,
  connectionError,
  type PortType,
  portTypeFor,
  VALUE_TYPES,
  type ValueType,
} from './ports';
