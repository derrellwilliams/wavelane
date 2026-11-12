/// Reads a number from tokens.css for the few places script needs one (image request sizes, the
/// grid's row height), so the value still lives in one place.

const cache = new Map<string, number>();

export function token(name: string): number {
  let value = cache.get(name);
  if (value === undefined) {
    value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
    cache.set(name, value);
  }
  return value;
}
