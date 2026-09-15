/**
 * Dotted-path get/set over plain objects.
 *
 * Pending settings changes are stored as a patch rather than a whole snapshot
 * of the next settings object. That matters: a change requested on Monday and
 * applied on Tuesday must not silently revert everything else the user altered
 * in between. A patch touches only what was actually asked for.
 */

export type Patch = Record<string, unknown>;

export function getPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Returns a deep-ish clone with the path set. Arrays are replaced wholesale. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.');
  const root: Record<string, unknown> = Array.isArray(obj)
    ? ([...(obj as unknown as unknown[])] as unknown as Record<string, unknown>)
    : { ...(obj as unknown as Record<string, unknown>) };

  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] as string;
    const child = cur[key];
    if (Array.isArray(child)) {
      cur[key] = [...child];
    } else if (child && typeof child === 'object') {
      cur[key] = { ...(child as Record<string, unknown>) };
    } else {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1] as string] = value;
  return root as unknown as T;
}

export function applyPatch<T>(obj: T, patch: Patch): T {
  let out = obj;
  for (const [path, value] of Object.entries(patch)) out = setPath(out, path, value);
  return out;
}

/** Stable key for a patch, used to dedupe repeated requests for one change. */
export function patchKey(patch: Patch): string {
  return Object.keys(patch).sort().join('|');
}

/** Paths whose values differ between two objects, limited to a known list. */
export function diffPaths(a: unknown, b: unknown, paths: string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const av = getPath(a, p);
    const bv = getPath(b, p);
    if (JSON.stringify(av) !== JSON.stringify(bv)) out.push(p);
  }
  return out;
}
