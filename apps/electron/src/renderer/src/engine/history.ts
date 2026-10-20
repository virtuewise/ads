// ── Undo/Redo & Command History ───────────────────────────────────────────────
// Every user action is a command with do/undo. The history stack wraps the
// document and provides push/undo/redo. See docs/36-UNDO-REDO.md.

import type { ProjectDocument, TimelineDoc } from './types';

/** A reversible document transform. */
export interface Command {
  id: string;
  label: string;
  /** Apply the command, returning the new document. */
  do(doc: ProjectDocument): ProjectDocument;
  /** Reverse the command, returning the previous document. */
  undo(doc: ProjectDocument): ProjectDocument;
  /** Merge with the previous command (for drags). Return null to not merge. */
  mergeWith?(prev: Command): Command | null;
}

export interface History {
  past: Command[];
  future: Command[];
  limit: number;
}

export function createHistory(limit = 100): History {
  return { past: [], future: [], limit };
}

export interface DocumentStore {
  doc: ProjectDocument;
  history: History;
}

export function createDocumentStore(doc: ProjectDocument): DocumentStore {
  return { doc, history: createHistory() };
}

let cmdCounter = 0;
function nextCmdId(): string {
  cmdCounter += 1;
  return `cmd-${Date.now().toString(36)}-${cmdCounter}`;
}

/** Apply a command: push to past, clear future, update doc. */
export function dispatch(store: DocumentStore, command: Command): DocumentStore {
  const doc = command.do(store.doc);
  const past = [...store.history.past, command];
  if (past.length > store.history.limit) past.shift();
  return { doc, history: { ...store.history, past, future: [] } };
}

/** Try to merge the command with the last one (for drags). */
export function dispatchMerged(store: DocumentStore, command: Command): DocumentStore {
  const last = store.history.past[store.history.past.length - 1];
  if (last && command.mergeWith) {
    const merged = command.mergeWith(last);
    if (merged) {
      const past = [...store.history.past.slice(0, -1), merged];
      return {
        doc: merged.do(undoDoc(store, last)),
        history: { ...store.history, past, future: [] },
      };
    }
  }
  return dispatch(store, command);
}

function undoDoc(store: DocumentStore, command: Command): ProjectDocument {
  return command.undo(store.doc);
}

export function canUndo(store: DocumentStore): boolean {
  return store.history.past.length > 0;
}

export function canRedo(store: DocumentStore): boolean {
  return store.history.future.length > 0;
}

/** Undo: pop from past, push to future, revert doc. */
export function undo(store: DocumentStore): DocumentStore {
  const cmd = store.history.past[store.history.past.length - 1];
  if (!cmd) return store;
  const doc = cmd.undo(store.doc);
  return {
    doc,
    history: {
      ...store.history,
      past: store.history.past.slice(0, -1),
      future: [...store.history.future, cmd],
    },
  };
}

/** Redo: pop from future, push to past, re-apply doc. */
export function redo(store: DocumentStore): DocumentStore {
  const cmd = store.history.future[store.history.future.length - 1];
  if (!cmd) return store;
  const doc = cmd.do(store.doc);
  return {
    doc,
    history: {
      ...store.history,
      future: store.history.future.slice(0, -1),
      past: [...store.history.past, cmd],
    },
  };
}

/** Replace the document without recording (file load, etc.). */
export function replaceDoc(store: DocumentStore, doc: ProjectDocument): DocumentStore {
  return { doc, history: createHistory(store.history.limit) };
}

/** Create a command with an auto-generated id. */
export function makeCommand(
  label: string,
  doFn: (doc: ProjectDocument) => ProjectDocument,
  undoFn: (doc: ProjectDocument) => ProjectDocument,
  mergeWith?: (prev: Command) => Command | null,
): Command {
  return { id: nextCmdId(), label, do: doFn, undo: undoFn, mergeWith };
}

// ── Drag command (mergeable) ──────────────────────────────────────────────────

export class DragCommand implements Command {
  id: string;
  label: string;
  private fromDoc: ProjectDocument;
  private toDoc: ProjectDocument;

  constructor(label: string, fromDoc: ProjectDocument, toDoc: ProjectDocument) {
    this.id = nextCmdId();
    this.label = label;
    this.fromDoc = fromDoc;
    this.toDoc = toDoc;
  }

  do(): ProjectDocument {
    return this.toDoc;
  }

  undo(): ProjectDocument {
    return this.fromDoc;
  }

  mergeWith(prev: Command): Command | null {
    if (prev instanceof DragCommand && prev.label === this.label) {
      return new DragCommand(this.label, prev.fromDoc, this.toDoc);
    }
    return null;
  }
}

export function makeDragCommand(
  label: string,
  fromDoc: ProjectDocument,
  toDoc: ProjectDocument,
): DragCommand {
  return new DragCommand(label, fromDoc, toDoc);
}

// ── Timeline drag command (mergeable, timeline-scoped) ────────────────────────

export class TimelineDragCommand implements Command {
  id: string;
  label: string;
  private fromDoc: TimelineDoc;
  private toDoc: TimelineDoc;

  constructor(label: string, fromDoc: TimelineDoc, toDoc: TimelineDoc) {
    this.id = nextCmdId();
    this.label = label;
    this.fromDoc = fromDoc;
    this.toDoc = toDoc;
  }

  do(doc: ProjectDocument): ProjectDocument {
    return { ...doc, timeline: this.toDoc };
  }

  undo(doc: ProjectDocument): ProjectDocument {
    return { ...doc, timeline: this.fromDoc };
  }

  mergeWith(prev: Command): Command | null {
    if (prev instanceof TimelineDragCommand && prev.label === this.label) {
      return new TimelineDragCommand(this.label, prev.fromDoc, this.toDoc);
    }
    return null;
  }
}

export function makeTimelineDragCommand(
  label: string,
  fromDoc: TimelineDoc,
  toDoc: TimelineDoc,
): TimelineDragCommand {
  return new TimelineDragCommand(label, fromDoc, toDoc);
}
