/**
 * TEST-ONLY helper: an in-memory `window.sessionStorage` for Bun unit tests
 * (Bun has no DOM). Import it only from *.test.ts files.
 */

export interface MemorySessionStorage {
  /** The raw stored values, for asserting what was written. */
  readonly store: Map<string, string>;
  /** Simulate blocked storage (e.g. privacy mode): reads and writes throw. */
  setBlocked(blocked: boolean): void;
  /** Clear all values and unblock. Call in beforeEach. */
  reset(): void;
}

// One shared instance: Bun runs all test files in one process, so every file must
// use the same `window`. Tests stay isolated by calling reset() in beforeEach.
let instance: MemorySessionStorage | null = null;

export function installMemorySessionStorage(): MemorySessionStorage {
  instance ??= createMemorySessionStorage();
  return instance;
}

function createMemorySessionStorage(): MemorySessionStorage {
  const store = new Map<string, string>();
  let blocked = false;

  const guard = () => {
    if (blocked) throw new Error("sessionStorage is blocked");
  };

  const storage: Storage = {
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => {
      guard();
      return store.get(key) ?? null;
    },
    setItem: (key, value) => {
      guard();
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: storage },
    configurable: true,
    writable: true,
  });

  return {
    store,
    setBlocked: (value) => {
      blocked = value;
    },
    reset: () => {
      store.clear();
      blocked = false;
    },
  };
}
