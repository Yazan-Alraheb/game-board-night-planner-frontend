import type { CollectionGame, CollectionStatus } from "@/types/collection";

/**
 * Local changes (status switches, removals) made on top of one loaded collection.
 * `source` is the exact array they were made on: when the collection is loaded again
 * (another user, a new session, Retry) the source changes and the old edits are dropped,
 * so a previous account's or an obsolete request's data is never shown.
 */
export interface CollectionEdits {
  source: readonly CollectionGame[] | null;
  entries: readonly CollectionGame[];
}

export const NO_EDITS: CollectionEdits = { source: null, entries: [] };

/** The entries to show for the currently loaded collection. */
export function visibleCollection(
  source: readonly CollectionGame[] | null,
  edits: CollectionEdits,
): readonly CollectionGame[] {
  if (source === null) return [];
  return edits.source === source ? edits.entries : source;
}

/**
 * Applies one change to the entries of `source`. If the edits belong to a different
 * (older or newer) load, the change is applied to `source` alone and only shows while
 * `source` is still the loaded collection.
 */
export function editCollection(
  edits: CollectionEdits,
  source: readonly CollectionGame[],
  change: (entries: readonly CollectionGame[]) => readonly CollectionGame[],
): CollectionEdits {
  const base = edits.source === source ? edits.entries : source;
  return { source, entries: change(base) };
}

export function withStatus(gameId: number, status: CollectionStatus) {
  return (entries: readonly CollectionGame[]) =>
    entries.map((entry) => (entry.game.id === gameId ? { ...entry, status } : entry));
}

export function withoutGame(gameId: number) {
  return (entries: readonly CollectionGame[]) => entries.filter((entry) => entry.game.id !== gameId);
}

export function entriesForTab(entries: readonly CollectionGame[], tab: CollectionStatus): CollectionGame[] {
  return entries.filter((entry) => entry.status === tab);
}

/** Wording for the Remove confirmation. */
export function removalCopy(entry: CollectionGame): { title: string; description: string } {
  const list = entry.status === "owned" ? "your owned games" : "your wishlist";
  return {
    title: `Remove ${entry.game.name}?`,
    description: `${entry.game.name} will be removed from ${list}. You can add it again from its game page.`,
  };
}
