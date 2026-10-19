// ── Selection & Interaction Model ─────────────────────────────────────────────
// Multi-select for clips, nodes, layers, effects, keyframes. See docs/37.

export interface Selection {
  clips: string[];
  nodes: string[];
  layers: string[];
  effects: string[];
  keyframes: string[];
  primary: { kind: SelKind; id: string } | null;
}

export type SelectionMode = 'replace' | 'add' | 'toggle' | 'range';

export type SelKind = 'clip' | 'node' | 'layer' | 'effect' | 'keyframe';

export interface SelTarget {
  kind: SelKind;
  id: string;
}

export function createSelection(): Selection {
  return { clips: [], nodes: [], layers: [], effects: [], keyframes: [], primary: null };
}

function addTo(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

function removeFrom(list: string[], id: string): string[] {
  return list.filter((x) => x !== id);
}

function toggleIn(list: string[], id: string): string[] {
  return list.includes(id) ? removeFrom(list, id) : addTo(list, id);
}

function propName(kind: SelKind): keyof Selection {
  switch (kind) {
    case 'clip':
      return 'clips';
    case 'node':
      return 'nodes';
    case 'layer':
      return 'layers';
    case 'effect':
      return 'effects';
    case 'keyframe':
      return 'keyframes';
  }
}

function listFor(sel: Selection, kind: SelKind): string[] {
  return sel[propName(kind)] as string[];
}

function setList(sel: Selection, kind: SelKind, list: string[]): Selection {
  return { ...sel, [propName(kind)]: list } as Selection;
}

/** Apply a selection operation. */
export function select(
  sel: Selection,
  target: SelTarget,
  mode: SelectionMode = 'replace',
): Selection {
  const list = listFor(sel, target.kind);
  let next: string[];
  switch (mode) {
    case 'replace':
      next = [target.id];
      break;
    case 'add':
      next = addTo(list, target.id);
      break;
    case 'toggle':
      next = toggleIn(list, target.id);
      break;
    case 'range':
      next = [target.id];
      break;
  }
  const updated = setList(sel, target.kind, next);
  const stillSelected = listFor(updated, target.kind).includes(target.id);
  return {
    ...updated,
    primary: stillSelected ? { kind: target.kind, id: target.id } : sel.primary,
  };
}

/** Select all items of a given kind. */
export function selectAll(sel: Selection, kind: SelTarget['kind'], allIds: string[]): Selection {
  return {
    ...setList(sel, kind, allIds),
    primary: sel.primary,
  };
}

/** Clear all selections. */
export function deselectAll(sel: Selection): Selection {
  return createSelection();
}

/** Invert selection for a given kind. */
export function selectInvert(sel: Selection, kind: SelTarget['kind'], allIds: string[]): Selection {
  const current = listFor(sel, kind);
  const inverted = allIds.filter((id) => !current.includes(id));
  return setList(sel, kind, inverted);
}

/** Remove selected items from a list. */
export function deleteSelected(list: string[], sel: Selection, kind: SelTarget['kind']): string[] {
  const selected = listFor(sel, kind);
  return list.filter((id) => !selected.includes(id));
}

/** Check if an item is selected. */
export function isSelected(sel: Selection, kind: SelTarget['kind'], id: string): boolean {
  return listFor(sel, kind).includes(id);
}

/** Get the count of selected items. */
export function selectionCount(sel: Selection): number {
  return (
    sel.clips.length +
    sel.nodes.length +
    sel.layers.length +
    sel.effects.length +
    sel.keyframes.length
  );
}

/** Get the primary selection target. */
export function primarySelection(sel: Selection): SelTarget | null {
  return sel.primary;
}

// ── Marquee selection ─────────────────────────────────────────────────────────

export interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SelectableItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Find items intersecting a marquee rectangle. */
export function marqueeSelect(items: SelectableItem[], rect: MarqueeRect): string[] {
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.w;
  const rh = rect.h;
  const rx2 = rx + rw;
  const ry2 = ry + rh;
  return items
    .filter((item) => {
      const ix2 = item.x + item.w;
      const iy2 = item.y + item.h;
      return item.x < rx2 && ix2 > rx && item.y < ry2 && iy2 > ry;
    })
    .map((item) => item.id);
}

/** Find items fully contained in a marquee rectangle. */
export function marqueeSelectContained(items: SelectableItem[], rect: MarqueeRect): string[] {
  const rx = rect.x;
  const ry = rect.y;
  const rx2 = rect.x + rect.w;
  const ry2 = rect.y + rect.h;
  return items
    .filter(
      (item) => item.x >= rx && item.y >= ry && item.x + item.w <= rx2 && item.y + item.h <= ry2,
    )
    .map((item) => item.id);
}
