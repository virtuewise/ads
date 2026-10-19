# 05 — Project Format: The `.vfxproj` Dual Format

**Status: ✅ · Code: `engine/project.ts`, `main/projectCodec.ts`, `main/project.ts`**

> A project is a single `ProjectDocument`. It can be written to disk in **two first-class encodings**:
> a deterministic, git-diffable **JSON** file (`.vfxproj`) and a compact, checksummed **binary** file
> (`.vfxproj.bin`). The user picks which, per save. Opening detects the format automatically.

---

## Why two formats

The user asked for exactly this: *"BOTH human-readable, git-versioned `.vfxproj` (JSON) — or binary. a
user either choose which option they prefer."*

| | JSON (`.vfxproj`) | Binary (`.vfxproj.bin`) |
|---|---|---|
| **Human-readable** | Yes | No |
| **Git-diffable** | Yes — line-level diffs | No (opaque changes) |
| **Agent-friendly** | Yes — read/write by hand or script | Requires the codec |
| **Integrity check** | None | SHA-256 trailer |
| **Size** | Large (pretty JSON) | Small (gzip level 9) |
| **Best for** | Collaboration, review, versioning, agents | Archival, fast transfer, checksummed backups |

Both encode **the same document**. Moving between them is lossless (modulo JSON's own formatting).

---

## The document

`ProjectDocument` (`engine/types.ts`), built by `buildProject()`:

```typescript
interface ProjectDocument {
  format: 'vfxproj';
  version: number;              // PROJECT_VERSION = 1
  savedAt: string;              // ISO timestamp
  app: { name: string; version: string };   // 'Virtue Studio', '0.1.0'
  composition: CompositionState; // name, width, height, fps, duration, background, transform
  genre: GenreId;               // one of six
  safeZones: SafeZoneState;     // { active, ratio }
  brandLUT: string;             // LUT id
  timeline: TimelineDoc;        // { duration, clips[] }
  graph: DAG;                   // { nodes, edges }
  effectsStack: string[];
}
```

See [03-ENGINE-CORE](03-ENGINE-CORE.md) for `DAG`, [06-TIMELINE](06-TIMELINE.md) for `TimelineDoc`, and
[18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md) for `brandLUT` ids.

---

## Renderer side — `engine/project.ts`

Pure logic; no fs, no Electron.

| Export | Purpose |
|---|---|
| `PROJECT_VERSION` (1), `APP_NAME`, `APP_VERSION` | Constants stamped into the document |
| `JSON_EXT` (`.vfxproj`), `BINARY_EXT` (`.vfxproj.bin`) | Canonical extensions |
| `createDefaultTransform()` | `{x:0,y:0,scale:1,rotation:0,opacity:1}` |
| `createDefaultComposition()` | 1920×1080, 30 fps, 12s, background `#07090d` |
| `buildProject(input)` | Assembles a full document from live state |
| `normalizeProject(raw)` | **Coerces arbitrary parsed data into a valid document** |
| `slugify(name)` | Filename-safe slug (fallback `composition`) |
| `suggestedFileName(doc, format)` | `<slug>.vfxproj` or `<slug>.vfxproj.bin` |
| `SaveResult`, `OpenResult` | IPC result shapes shared with preload |

### `normalizeProject` — the forward-compatibility contract

Any JSON that arrives by *any* door (disk, agent, hand-edit, older version) is passed through
`normalizeProject` before it touches app state. It:

- **Never throws.** Every field falls back to a default via helpers `num()`, `str()`, and explicit
  guards.
- **Clamps** `width`/`height`/`fps` to ≥ 1 and `duration` to ≥ 0.1.
- **Validates enums**: `genre` must be one of the six; `safeZones.ratio` one of four; keyframe `easing`
  one of four. Invalid values become defaults (`corporate`, `16:9`, `easeInOut`).
- **Sanitizes the timeline**: drops non-object clips, coerces each, and sorts keyframes by time.
- **Guards the graph**: requires `nodes` and `edges` arrays or substitutes an empty DAG.

This is what makes the system robust to agent-authored documents — the agent can be sloppy; the loader
is strict-but-forgiving.

---

## Main side — `main/projectCodec.ts` (pure)

The codec imports **only** `node:crypto` and `node:zlib` — no Electron — so it is unit-testable in
isolation.

### JSON encoding

```typescript
serializeJson(doc)
// => Buffer of `${JSON.stringify(sortDeep(doc), null, 2)}\n`
```

- **`sortDeep`** recursively sorts every object's keys. This makes output **deterministic**: the same
  document always serializes to the same bytes, so unrelated edits produce minimal, meaningful diffs
  and no spurious "everything changed" churn.
- **2-space indent** and a **trailing newline** — POSIX-friendly, review-friendly.

### Binary encoding

```
┌────────┬────────────────┬───────────────────────────┬──────────────┐
│ 'VFXP' │ uint32 LE vert │ gzip(JSON(doc), level 9)  │ sha256(payld)│
│ 4 bytes│ 4 bytes        │ variable                  │ 32 bytes     │
└────────┴────────────────┴───────────────────────────┴──────────────┘
```

- **Magic** `VFXP` lets any reader identify the file by content, not extension.
- **Version** is a little-endian uint32 (currently `1`) — the migration hook.
- **Payload** is gzip level 9 of the *unsorted* JSON (determinism is a JSON-mode concern).
- **Digest** is the SHA-256 of the payload, appended as a trailer.

### Decoding & detection

```typescript
parseBinary(buf)         // validates magic, version, checksum; throws with a precise message
detectFormat(buf, path)  // magic bytes first, then '.bin' extension, else 'json'
parseProject(buf, path) // -> { format, doc }
formatForPath(path, req) // explicit request wins, else extension
withExtension(path, fmt) // ensures a recognizable extension
```

`parseProject` strips a UTF-8 BOM before JSON parsing (Windows-friendly).

**Detection order matters:** a `.txt` file starting with `VFXP` is treated as binary; a file with no
magic is JSON unless it ends in `.bin`. This is why a wrong extension still loads correctly — content
beats naming.

### Error messages (surfaced to the user/agent)

| Condition | Message |
|---|---|
| Too short for header+digest | `File is too small to be a project` |
| Bad magic | `Not a Virtue binary project` |
| Unknown version | `Unsupported binary project version N` |
| Digest mismatch | `Corrupt project: checksum mismatch` |

---

## Main side — `main/project.ts` (fs + dialogs)

Registers the four project IPC handlers used by `window.studio.project.*`:

| Handler | Preload method | Behaviour |
|---|---|---|
| `project:save` | `saveProject(doc, {path?, format?})` | Save As flow; format from explicit arg or path; normalizes extension |
| `project:open` | `openProject()` | Open dialog → read → `parseProject` → returns `{path, format, doc}` |
| `project:write` | `writeProject(path, doc, format)` | Write to a known path (no dialog) — for autosave/agents |
| `project:read` | `readProject(path)` | Read + parse a known path |

> **Windows dialog note:** filters with a compound extension (`vfxproj.bin`) are unreliable. The format is
> therefore inferred from the **explicit `format` argument**, with the path as a tiebreaker — never from
> the dialog filter alone. See [20-OPERATIONS](20-OPERATIONS.md).

---

## Versioning & migration policy

- `version` is the document schema version; `BIN_VERSION` is the *container* version. They evolve
  independently.
- **Reading forward:** `normalizeProject` tolerates missing/extra fields, so a v1 reader safely loads
  most future documents (it ignores what it doesn't know).
- **Reading backward:** a binary file whose `BIN_VERSION` is unknown is rejected loudly rather than
  misparsed. A bump must ship a migration path.
- **Bumping rules:**
  1. Additive field → bump `PROJECT_VERSION`, extend `normalizeProject` defaults, document here.
  2. Breaking change → bump `PROJECT_VERSION` **and** write a migration in `normalizeProject`.
  3. Container change (compression, header) → bump `BIN_VERSION`, keep old readers working or fail loudly.

---

## Agent workflow against a project

An agent never needs the Electron app to author a project:

```bash
# 1. Read the current project (JSON or binary — the codec detects)
node -e "…"  # or use the codec directly
# 2. Mutate the JSON (add clips, set genre, set brandLUT)
# 3. Write it back
```

Because JSON mode is deterministic and sorted, an agent's change shows up as a **small, reviewable
diff** — the human can see exactly what the agent did. See [17-AI-AGENTS](17-AI-AGENTS.md) and
[08-SCRIPTING-API](08-SCRIPTING-API.md).

---

## Example: a minimal document

```json
{
  "app": { "name": "Virtue Studio", "version": "0.1.0" },
  "brandLUT": "cool-tech",
  "composition": {
    "background": "#07090d",
    "duration": 12,
    "fps": 30,
    "height": 1080,
    "name": "Untitled Composition",
    "transform": { "opacity": 1, "rotation": 0, "scale": 1, "x": 0, "y": 0 },
    "width": 1920
  },
  "effectsStack": [],
  "format": "vfxproj",
  "genre": "corporate",
  "graph": { "edges": [], "nodes": [] },
  "safeZones": { "active": false, "ratio": "16:9" },
  "savedAt": "2026-01-01T00:00:00.000Z",
  "timeline": { "clips": [], "duration": 12 },
  "version": 1
}
```

*(keys sorted by `sortDeep`.)*

---

Related: [03-ENGINE-CORE](03-ENGINE-CORE.md) · [06-TIMELINE](06-TIMELINE.md) ·
[08-SCRIPTING-API](08-SCRIPTING-API.md) · [17-AI-AGENTS](17-AI-AGENTS.md)
