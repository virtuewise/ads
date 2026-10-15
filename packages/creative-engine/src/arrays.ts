/**
 * Array index helpers for the creative engine.
 *
 * These replace non-null assertions on array access: under
 * `noUncheckedIndexedAccess` every index read is `T | undefined`, so instead of
 * asserting, we read once and fail loudly (with a useful message) if the value
 * really is missing.
 */

/**
 * Return `items[index]`.
 *
 * @throws RangeError when the index is out of range.
 */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Index ${index} is out of range (length ${items.length})`);
  }
  return item;
}

/**
 * Return `items[index % items.length]`, wrapping the index around the array.
 *
 * @throws RangeError when `items` is empty.
 */
export function rotate<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];
  if (item === undefined) {
    throw new RangeError('Cannot rotate over an empty array');
  }
  return item;
}
