# Virtue Studio — Wiki

> **Premium visual storytelling, motion graphics, and cinematic advertising solutions that transform
> ideas into compelling brand experiences.**
>
> A persistent, brand-aware advertising engine that can ideate, strategize, write, design,
> generate, animate, edit, critique, adapt, archive, and continuously improve Virtue Studio advertising.

This wiki documents the `virtue-studio` repository — **Virtue Studio**, a TypeScript monorepo that
produces advertising for multiple brands (with PrintSync as the default template). It is written for anyone building, extending, or
operating the system.

---

## What is this?

A TypeScript monorepo (pnpm + Turborepo) that turns a **business objective** into finished
advertising — concepts, scripts, storyboards, motion, video, QA, and multi-format exports — through a
chain of small, single-responsibility **engines**.

The core principle:

```
BUSINESS OBJECTIVE
→ CREATIVE STRATEGY → CONCEPTS → CREATIVE JUDGE → SELECTED CONCEPT
→ SCRIPT → STORYBOARD → ART DIRECTION → ASSET PLAN → PRODUCTION
→ EDIT → SOUND → BRAND QA → CREATIVE QA → MARKETING QA
→ EXPORT → ARCHIVE → LEARNING
```

**Engineering principle:** *AI generates ingredients. Code controls the composition.
Deterministic rendering controls the final product.*

**Motion-First principle:** *Everything is motion-designed.* A poster is an animated key visual
(with still frames exported for print); stories and social posts are animated short-form motion.
There are no standalone static deliverables — see [Creative System](Creative-System) and the
[Roadmap](Roadmap).

---

## Start here

| If you want to… | Read |
|---|---|
| Install and run the project | [Getting Started](Getting-Started) |
| Understand how the system fits together | [Architecture](Architecture) |
| Find your way around the repo | [Repository Structure](Repository-Structure) |
| Use or extend a package | [Packages & Engines](Packages-and-Engines) |
| Run the CLI | [CLI Reference](CLI-Reference) |
| Use the programmatic API | [API Reference](API-Reference) |
| Understand the brand rules | [Brand](Brand) |
| Understand the motion engine and 3D renderer | [Motion & Renderer](Motion-and-Renderer) |
| Render at scale (AWS Lambda, FFmpeg delivery) | [Enterprise Rendering](Enterprise-Rendering) |
| Understand concept generation & scoring | [Creative System](Creative-System) |
| Follow brief → production plan | [Production Pipeline](Production-Pipeline) |
| Contribute | [Contributing](Contributing) |
| See what's built vs. planned | [Roadmap & Status](Roadmap) |

---

## Status at a glance

- **Phase 1 — Foundation:** complete (repo, monorepo, brand schema, CLI, docs).
- **Phase 2 — Creative Engine:** substantially implemented (concept generation, 10-dimension judge,
  anti-generic detection, diversity analysis, daily engine V2).
- **Phase 3 — Design + Production planning:** in progress. A deterministic pipeline
  (`buildProductionPlan`) now runs subject → story → visual grammar → script → storyboard → shots →
  scene graph. Many downstream engines are still stubs.
- **Phase 4 — Motion:** substantially implemented. The motion engine owns a millimetre-exact
  print-item catalogue, a frame-addressable animation library, procedural printed artwork, real
  signage and out-of-home formats, and a deterministic 3D city — all rendered by the Remotion app
  (see [Motion & Renderer](Motion-and-Renderer)). The living-city film is cut as a **shot list**:
  a travelling pass, then hard-cutting close-ups on the PrintSync shopfront, a digital screen and a
  road-safety sign.
- **Phases 5–8 (Video, QA execution, Daily production, Studio):** mostly planned, except the
  **enterprise rendering** path: `@printsync/render-farm` plans shards, can drive Remotion Lambda,
  and builds the FFmpeg delivery commands (see [Enterprise Rendering](Enterprise-Rendering)).

See [Roadmap & Status](Roadmap) for the honest per-area breakdown.

---

## Repository

- Package name: `virtue-studio` (`package.json`)
- Structure: `apps/` (studio, renderer, dashboard, demo) + `packages/` (23 engine/tooling packages)
- Source of truth for schemas: `@printsync/shared` and `@printsync/common`
- Source of truth for creative modes: `packages/creative-engine/src/modes.ts`

Footer — © 2026 Virtue Studio. Private.
