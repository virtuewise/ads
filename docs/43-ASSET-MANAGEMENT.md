# 43 — Asset Management & Media Organization

**Status: 🟡 (a media bin exists with import, drag-and-drop, and poster frames; no registration, search, tagging, or offline relink) · Code: `App.tsx` (media tab), `engine/demux.ts`, `engine/media.ts`, `main/media.ts`**

> A **media bin** now exists as the second tab of the left panel: it imports via a native file
> dialog or drag-and-drop, decodes the container, and shows each clip with a poster frame drawn
> from its first decoded frame. What is still missing is everything that makes it a *library*:
> assets are not registered, not persisted with the project, and cannot be searched or relinked.

---

## 1. The gap, precisely

| Capability | Today |
|---|---|
| Media bin UI | 🟡 a list in the left panel's **Media** tab |
| Import (drag-drop, picker) | ✅ **File → Import Media…** and a drop zone on the media bin |
| Asset thumbnails/posters | ✅ poster frame drawn from the first decoded `VideoFrame` |
| Bulk import | ✅ the file dialog allows multiple selections |
| Asset search | ⬜ none |
| Asset tagging | ⬜ none |
| Asset organization (bins, folders) | ⬜ none |
| Proxy management | ⬜ none |
| Media metadata display | 🟡 dimensions, fps, duration, frame count, codec (in the row tooltip) |
| Asset registration in the project document | ⬜ none — the bin lives in React state and is lost on reload |
| Offline/relink missing media | ⬜ none |

---

## 2. The media bin

### 2.1 The UI

A list in the left panel's **Media** tab, each row carrying a poster frame, the file name, and a
metadata line (`320×180 · 30.0fps · 2.0s · 60 frames`):

```
┌─ Media ──────────────────────────────┐
│ [⤒ Import Media…]                    │
│ ┌───────────────────────────────────┐ │
│ │      Drop a video file here       │ │
│ └───────────────────────────────────┘ │
│ MEDIA BIN                    1        │
│ ┌──────┐ ┌──────────────────────────┐│
│ │ ▶    │ │ testsrc.mp4              ││
│ │      │ │ 320×180 · 30fps · 2.0s   ││
│ └──────┘ │ 60 frames                ││
│          └──────────────────────────┘│
└──────────────────────────────────────┘
```

The target layout — a poster grid with search, filters, and bins — is in §2.1 of the original
spec below.

### 2.2 Import

- ✅ **Drag-and-drop** from the OS file manager onto the media bin.
- ✅ **File picker** via the "Import Media…" button (`media:pick` → `main/media.ts`).
- ✅ **Bulk import** — the file dialog allows multiple selections.
- ⬜ **Import URL** — paste a URL to download (stock footage, CDN).

### 2.3 Asset registration

Each imported file is probed ([29](29-MEDIA-PIPELINE.md)) and registered:

```typescript
interface MediaAsset {
  id: string;
  path: string;
  kind: 'video' | 'audio' | 'image' | 'sequence';
  hash: string;             // for dedupe
  probe: MediaProbe;         // streams, codecs, resolution, fps, duration, rotation
  duration: number;
  posters: string[];        // thumbnail frames
  peaksPath?: string;       // audio waveform cache
  proxyPath?: string;       // optional low-res proxy
  status: 'ready' | 'probing' | 'error';
}
```

---

## 3. Asset organization

### 3.1 Bins and folders

```
Media
├── 📁 Footage
│   ├── 📁 Hero Shots
│   │   ├── hero-01.mov
│   │   └── hero-02.mov
│   └── 📁 B-Roll
│       ├── drone-01.mov
│       └── street-01.mov
├── 📁 Audio
│   ├── score-main.wav
│   └── sfx-footsteps.wav
├── 📁 Images
│   ├── logo.png
│   └── background.jpg
└── 📁 Generated
    ├── ai-hero-01.mp4
    └── ai-background-01.png
```

### 3.2 Tags and metadata

| Field | Type | Use |
|---|---|---|
| `tags` | string[] | organize, filter, search |
| `rating` | 0–5 stars | take selection |
| `notes` | text | annotations |
| `colorLabel` | color | visual grouping |
| `usedIn` | clipId[] | where is this asset used |

### 3.3 Search and filter

- **Text search:** name, path, notes, tags.
- **Technical filter:** resolution, fps, codec, duration, kind.
- **Smart bins:** "unused", "missing", "high-resolution", "generated".
- **Sort:** name, date, duration, rating.

---

## 4. Thumbnails and posters

### 4.1 Poster frames

Generated on import via FFmpeg:

- **First frame** — the default thumbnail.
- **Filmstrip** — N frames across the duration (for hover scrub).
- **Mid-frame** — for a representative thumbnail.

### 4.2 Hover scrub

Hovering an asset in the bin scrubs through the filmstrip — a quick preview without opening the
asset.

### 4.3 Timeline thumbnails

Clips on the timeline show their poster frames at the current zoom — the standard NLE filmstrip.

---

## 5. Proxy management

### 5.1 Proxy generation

On import, generate a low-res proxy for smooth editing:

| Source | Proxy | Use |
|---|---|---|
| 4K | 1080p H.264 | editing |
| 8K | 1080p H.264 | editing |
| 1080p | 540p H.264 | low-spec hardware |

### 5.2 Quality toggle

A viewport setting: **Full** / **Half** / **Quarter** — switches between source and proxy.
Export always uses full-res source ([30](30-RENDER-QUEUE.md)).

---

## 6. Missing media

### 6.1 Detection

On project load, every `mediaId` is checked:

- **Found** → ready.
- **Missing** → flagged in the media bin (red icon) and on the timeline (offline clip).

### 6.2 Relink

- **Browse** — point to the missing file's new location.
- **Search** — scan a folder for matching files (by name or hash).
- **Batch relink** — relink all missing assets in a folder.

---

## 7. Generated assets

AI-generated media ([35](35-AI-VIDEO-GENERATION.md)) appears in a **Generated** bin:

- Tagged with the model, seed, and prompt.
- Regenerable (same seed → same output).
- Editable like any other asset.

---

## 8. Asset details

Clicking an asset shows a details panel:

| Field | Value |
|---|---|
| Name | `hero-01.mov` |
| Kind | Video |
| Resolution | 3840×2160 |
| Duration | 0:30.00 |
| FPS | 23.976 |
| Codec | ProRes 422 |
| File size | 1.2 GB |
| Location | `C:\Footage\Hero\hero-01.mov` |
| Tags | `hero`, `outdoor`, `golden-hour` |

---

## 9. Verification

| Property | Test | Status |
|---|---|---|
| Import | a dropped file appears in the media bin | ✅ verified in the running app |
| Decode | the imported clip reports its real dimensions, fps, duration, and frame count | ✅ verified in the running app |
| Thumbnail | poster frames match the video content | ✅ verified (the poster is drawn from the decoded frame) |
| Bulk import | the file dialog accepts multiple files | ✅ |
| Dedup | importing the same file twice does not duplicate | ⬜ |
| Registration | imported assets survive a project save/reload | ⬜ |
| Search | a text search finds the right asset | ⬜ |
| Missing detection | removing a file and reloading flags it | ⬜ |
| Relink | browsing to the new location restores the asset | ⬜ |
| Proxy | the quality toggle switches between source and proxy | ⬜ |

---

Related: [29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md) · [35-AI-VIDEO-GENERATION](35-AI-VIDEO-GENERATION.md) ·
[34-TEMPLATES-AND-PRESETS](34-TEMPLATES-AND-PRESETS.md) · [06-TIMELINE](06-TIMELINE.md)
