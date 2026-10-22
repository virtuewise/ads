# 49 — Complete Data Model Reference

**Status: 🟡 (the types exist; this is the authoritative schema) · Code: `engine/types.ts`, `engine/timeline.ts`, `engine/project.ts`, `main/projectCodec.ts`**

> Every type in the system, in one place. This is the authoritative schema — the type definitions
> as they exist today, with the extensions the advanced system adds.

---

## 1. Project document

The root of everything:

```typescript
// engine/types.ts + engine/project.ts
interface ProjectDocument {
  version: number;              // PROJECT_VERSION
  name: string;
  genre: GenreId;
  composition: CompositionState;
  transform: TransformState;
  timeline: TimelineDoc;
  graph: DAG;
  effectsStack: string[];
  captions: { visible: boolean; locked: boolean };
  tracks: Record<string, { visible: boolean; locked: boolean }>;
  brandLUT: string;
  safeZoneRatio: SafeZoneRatio;
  // ── extended by the advanced system ──
  layers?: Layer[];             // compositor layers [22]
  audio?: AudioState;           // audio clips + buses [25]
  captionsData?: CaptionData;  // caption cues + styles [26]
  color?: ColorState;          // grade chain + color management [23]
  media?: MediaState;          // media index [29]
  history?: History;           // undo/redo [36]
  selection?: Selection;       // current selection [37]
}
```

---

## 2. Composition

```typescript
interface CompositionState {
  name: string;
  width: number;               // px
  height: number;              // px
  fps: number;
  duration: number;            // seconds
  background: string;          // hex color
  transform: TransformState;
}
```

---

## 3. Transform

```typescript
interface TransformState {
  x: number;                   // px (normalized in packUniforms)
  y: number;                   // px
  scale: number;               // uniform (1 = 100%)
  rotation: number;            // degrees
  opacity: number;             // 0–1
}
```

**Extensions** ([22](22-COMPOSITOR.md#transform-stack-25d-not-just-2d)):

```typescript
interface TransformStack {
  anchorPoint: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number };       // per-axis
  rotation: { x: number; y: number; z: number };  // 3D
  skew: { x: number; y: number };
  opacity: number;
  // …each element keyframeable
}
```

---

## 4. Timeline

```typescript
interface TimelineDoc {
  duration: number;
  clips: TimelineClip[];
}

interface TimelineClip {
  id: string;
  trackId: string;             // 'video' | 'audio' | 'captions' | 'effects' | 'transitions'
  start: number;               // seconds
  end: number;                 // seconds
  name: string;
  keyframes: Keyframe[];
  // ── extended ──
  mediaId?: string;            // source asset [29]
  sourceStart?: number;        // in-point in source
  transition?: TransitionDefinition; // linked dip transition, on a transition-track clip
  speed?: number;              // retime factor
  reverse?: boolean;
  transform?: TransformStack;  // per-clip transform [22]
  effects?: string[];          // effect node ids
  grade?: string[];            // grade node ids
}

interface TransitionDefinition {
  type: 'dip-black' | 'dip-white' | 'dip-color';
  fromClipId: string;
  toClipId: string;
  color: string;
  easing: KeyframeEasing;
}

interface Keyframe {
  id: string;
  time: number;                // seconds
  property: string;            // 'opacity' | 'scale' | 'x' | 'y' | 'rotation' | …
  value: number;               // scalar
  easing: KeyframeEasing;      // 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
}
```

---

## 5. Tracks

```typescript
const TRACKS: TrackMeta[] = [
  { id: 'video',       name: 'Video',       icon: 'film',     color: '#ff5a2c' },
  { id: 'audio',       name: 'Audio',       icon: 'music',    color: '#5eead4' },
  { id: 'captions',    name: 'Captions',    icon: 'captions', color: '#ffb347' },
  { id: 'effects',     name: 'Effects',     icon: 'wand',     color: '#a78bfa' },
  { id: 'transitions', name: 'Transitions', icon: 'shuffle',  color: '#f472b6' },
];
```

---

## 6. DAG (node graph)

```typescript
interface DAG {
  nodes: NodeInstance[];
  edges: Edge[];
}

interface NodeInstance {
  id: string;
  type: string;                // 'dataSource' | 'transform' | 'glow' | 'render' | …
  position: { x: number; y: number };
  params: Record<string, unknown>;
}

interface Edge {
  id: string;
  from: { nodeId: string; portId: string };
  to: { nodeId: string; portId: string };
}

interface Port {
  id: string;
  name: string;
  type: PortType;              // 'number' | 'string' | 'texture' | 'color' | 'bool'
  direction: 'input' | 'output';
  default?: unknown;
}
```

---

## 7. Genres

```typescript
type GenreId = '3d-animation' | 'narrative' | 'corporate' | 'explainer' | 'documentary' | 'detective';

interface Genre {
  id: GenreId;
  name: string;
  objective: string;
  // …workflow data
}
```

---

## 8. Export

```typescript
interface ExportSettings {
  format: ExportFormat;        // 'mp4' | 'mov' | 'webm' | 'prores'
  resolution: ExportResolution; // '1080p' | '4k' | '8k'
  fps: number;
  codec: string;
  bitrate: number;
  colorSpace: string;
  useHardwareEncoder: boolean;
}
```

---

## 9. Safe zones

```typescript
type SafeZoneRatio = '16:9' | '9:16' | '1:1' | '4:5' | '2.39:1';

interface SafeZone {
  ratio: SafeZoneRatio;
  title: { x: number; y: number; w: number; h: number };
  action: { x: number; y: number; w: number; h: number };
}
```

---

## 10. Brand LUTs

```typescript
interface BrandLUT {
  id: string;                  // 'none' | 'warm-brand' | 'cool-tech' | 'cinematic' | 'vibrant'
  name: string;
  shadow: { color: string; intensity: number };
  midtone: { color: string; intensity: number };
  highlight: { color: string; intensity: number };
}
```

---

## 11. Advanced types (target)

### 11.1 Layers ([22](22-COMPOSITOR.md))

```typescript
type LayerKind = 'media' | 'text' | 'shape' | 'solid' | 'adjustment' | 'null' | 'camera' | 'precomp';
interface Layer {
  id: string; name: string; kind: LayerKind; enabled: boolean;
  parentId: string | null;
  transform: TransformStack;
  opacity: number; blendMode: BlendMode;
  masks: Mask[]; effects: EffectRef[];
  motionBlur?: number; threeD?: Layer3D;
}
```

### 11.2 Audio ([25](25-AUDIO.md))

```typescript
interface AudioClip {
  id: string; trackId: string; mediaId: string;
  sourceStart: number; start: number; end: number;
  gain: number; fades: { in: number; out: number };
  keyframes: Keyframe[]; bus: 'master' | 'music' | 'dialogue' | 'sfx';
}
```

### 11.3 Captions ([26](26-CAPTIONS.md))

```typescript
interface CaptionCue {
  id: string; start: number; end: number; text: string;
  words: TranscriptWord[]; speaker?: string; styleId: string;
  position?: { anchor: 'auto' | 'top' | 'bottom' | 'custom'; x?: number; y?: number };
}
```

### 11.4 Color ([23](23-COLOR.md))

```typescript
interface ColorState {
  colorSpace: ColorSpaceId;
  outputTransform: ODTId;
  grade: GradeOp[];
}
```

### 11.5 History ([36](36-UNDO-REDO.md))

```typescript
interface History {
  past: Command[];
  future: Command[];
  limit: number;
}
```

### 11.6 Selection ([37](37-SELECTION-AND-INTERACTION.md))

```typescript
interface Selection {
  clips: string[]; nodes: string[]; layers: string[];
  effects: string[]; keyframes: string[];
  primary: { kind: string; id: string } | null;
}
```

---

## 12. Versioning

`ProjectDocument.version` is `PROJECT_VERSION` (currently 4):

| Version | Adds |
|---|---|
| 1 | base document |
| 2 | `assets[]`, `mediaId`, and `sourceStart` for imported media |
| 3 | optional `textNodeId` and per-clip `look` fields |
| 4 | optional transition definitions on transition-track clips |

`normalizeProject` migrates older documents forward — see
[05-PROJECT-FORMAT.md](05-PROJECT-FORMAT.md#versioning--migration-policy).

---

## 13. Verification

| Property | Test |
|---|---|
| Schema completeness | every field in this doc exists in the type definitions |
| Round-trip | `serialize → parse → serialize` produces identical bytes |
| Version migration | a v1 document loads and migrates to v2 |
| Determinism | the same document always serializes to the same bytes |

---

Related: [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) · [06-TIMELINE](06-TIMELINE.md) ·
[03-ENGINE-CORE](03-ENGINE-CORE.md) · [32-KEYFRAME-ANIMATION](32-KEYFRAME-ANIMATION.md) · [22-COMPOSITOR](22-COMPOSITOR.md)
