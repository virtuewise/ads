/**
 * Test-only helpers shared by the motion-engine suites.
 *
 * The linter bans non-null assertions, so tests make presence explicit through
 * these helpers: they return the narrowed value or fail with a readable message
 * that points at the missing fixture.
 */

import { getPrintItem, type PrintItemSpec, type ProfilePoint } from './print-items.js';

/** Fetch a print item by id, throwing when the catalogue has no such id. */
export function requireItem(id: string): PrintItemSpec {
  const item = getPrintItem(id);
  if (!item) throw new Error(`Unknown print item id: ${id}`);
  return item;
}

/** Assert a revolve profile exists on a print item and return it. */
export function requireProfile(item: PrintItemSpec): readonly ProfilePoint[] {
  const profile = item.profile;
  if (!profile || profile.length === 0) {
    throw new Error(`Print item ${item.id} does not define a revolve profile`);
  }
  return profile;
}

/** Return `value`, throwing when it is null or undefined. */
export function required<T>(
  value: T | null | undefined,
  message = 'Expected value to be defined',
): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}
