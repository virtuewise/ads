# 45 — Collaboration & Multi-Agent Workflows

**Status: 🟡 (genre playbooks exist in 17; no multi-agent runtime) · Code: `docs/17-AI-AGENTS.md` → target: `engine/collab/*`**

> The agent operating guide ([17](17-AI-AGENTS.md)) describes multi-agent workflows as a
> capability, but there is **no runtime** — no agent orchestration, no merge, no conflict detection.
> This document specifies the collaboration system.

---

## 1. What exists today

### 1.1 Genre playbooks (real)

`docs/17-AI-AGENTS.md` defines **genre playbooks** — deterministic procedures per genre:

```
corporate: brief → concept → template → assemble → brand-check → export
narrative: footage → select → assembly-edit → continuity → grade → sound → export
```

Each playbook is a sequence of named steps, each a pure document transform.

### 1.2 The agent API (real)

The `window.studio` bridge ([08](08-SCRIPTING-API.md)) lets an agent read engine data, apply genres,
and export. The v2 API ([31](31-AI-AGENTIC-SCALE.md)) adds high-level ops.

### 1.3 What's missing

| Capability | Today |
|---|---|
| Multi-agent orchestration | ⬜ none |
| Agent-to-agent communication | ⬜ none |
| Document branching | ⬜ none |
| Three-way merge | ⬜ none |
| Conflict detection | ⬜ none |
| Agent roles/personas | ⬜ playbooks only |
| Agent logging | ⬜ none |
| Human-in-the-loop review | ⬜ none |

---

## 2. The collaboration model (target)

### 2.1 Agent roles

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Creative   │────▶│   Assembly   │────▶│  Technical  │
│   Director   │     │    Editor    │     │    QA       │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
   concepts            composed doc          final doc
   storyboard          cut sequence          verified
   grade chain          transitions           exported
```

Each role is an **agent persona** with a specific responsibility:

| Role | Responsibility | Output |
|---|---|---|
| **Creative Director** | concepts, storyboard, grade chain | concept doc + storyboard |
| **Assembly Editor** | clip selection, timeline assembly | composed timeline |
| **Technical QA** | verification, export, delivery | verified + exported |

### 2.2 Agent communication

Agents communicate through the **document**, not through messages:

```
agent A ─▶ document branch A ─┐
                              ├─▶ three-way merge ─▶ merged document
agent B ─▶ document branch B ─┘
```

Each agent works on a **branch** — a copy of the document. When done, branches are merged.

---

## 3. Document branching

### 3.1 Branches

```typescript
interface DocumentBranch {
  id: string;
  name: string;
  parentId: string | null;
  doc: ProjectDocument;
  agentId: string;
  createdAt: string;
  status: 'active' | 'merged' | 'discarded';
}
```

A branch is a full copy of the document. Two agents working on different branches don't interfere.

### 3.2 Branch lifecycle

```
main ──► branch-A (creative) ──┐
  │                            ├──▶ merge ──▶ main
  └──▶ branch-B (assembly) ────┘
```

---

## 4. Three-way merge

### 4.1 The merge algorithm

Given a base document and two branches, the merge:

1. **Diff** each branch against the base.
2. **Classify** each change: add / modify / delete.
3. **Apply** non-conflicting changes from both branches.
4. **Detect** conflicts — both branches modified the same property.
5. **Report** conflicts with both values and a diff.

```typescript
interface MergeResult {
  doc: ProjectDocument;       // the merged document
  conflicts: Conflict[];      // conflicting changes
  applied: Change[];          // changes applied from both branches
}

interface Conflict {
  path: string;               // e.g. "timeline.clips[3].keyframes[0].value"
  base: unknown;
  branchA: unknown;
  branchB: unknown;
}
```

### 4.2 Structural merge

The merge is **structural**, not textual — it merges by object identity:

- `clip.id` — two agents adding different clips merge cleanly.
- `node.id` — two agents adding different nodes merge cleanly.
- `keyframe.id` — two agents adding different keyframes merge cleanly.

Only when both agents modify the **same object's same property** is there a conflict.

### 4.3 Conflict resolution

| Strategy | Behaviour |
|---|---|
| **Manual** | the human picks branch A, branch B, or a custom value |
| **Branch A** | always take branch A's value |
| **Branch B** | always take branch B's value |
| **Newest** | take the most recent change |
| **Union** | for additive changes (e.g. adding clips), take both |

---

## 5. Human-in-the-loop

### 5.1 Review points

The workflow has **review points** where a human approves before proceeding:

```
concept ──▶ [HUMAN REVIEW] ──▶ storyboard ──▶ [HUMAN REVIEW] ──▶
assembly ──▶ [HUMAN REVIEW] ──▶ export
```

### 5.2 Approval

At each review point:

- The human sees a **diff** of what the agent produced.
- The human can **approve**, **request changes**, or **reject**.
- Changes are fed back to the agent, which revises.

---

## 6. Agent logging

Every agent action is logged:

```typescript
interface AgentLogEntry {
  agentId: string;
  role: string;
  action: string;             // "applyGenre", "autoCaption", etc.
  params: Record<string, unknown>;
  timestamp: string;
  durationMs: number;
  result: 'success' | 'error';
  error?: string;
}
```

The log is:

- **Auditable** — every action is recorded with its parameters.
- **Reproducible** — the log + document can replay the entire session.
- **Debuggable** — errors are captured with context.

---

## 7. Verification

| Property | Test |
|---|---|
| Branch isolation | two agents on different branches don't interfere |
| Clean merge | non-conflicting changes from both branches apply |
| Conflict detection | same-property edits in both branches are flagged |
| Structural merge | different clips/nodes/keyframes merge cleanly |
| Human review | a review point blocks until approved |
| Logging | every agent action is logged with parameters |
| Reproducibility | the log + document replays the session |

---

Related: [17-AI-AGENTS](17-AI-AGENTS.md) · [31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md) ·
[36-UNDO-REDO](36-UNDO-REDO.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md)
