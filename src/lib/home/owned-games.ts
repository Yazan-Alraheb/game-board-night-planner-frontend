import type { CollectionGame } from "@/types/collection";

/**
 * IDs of owned games from GET /api/users/{id}/collection.
 * The request already uses ?status=owned; filtering again means a wishlist entry
 * is never treated as owned, even if the server returns one.
 */
export function ownedGameIdsFrom(entries: readonly CollectionGame[]): ReadonlySet<number> {
  return new Set(entries.filter((entry) => entry.status === "owned").map((entry) => entry.game.id));
}

/**
 * Whether to show the Owned badge. `ownedGameIds` is null when ownership is unknown
 * (signed out, still loading or the request failed): then nothing is marked owned.
 */
export function isGameOwned(ownedGameIds: ReadonlySet<number> | null, gameId: number): boolean {
  return ownedGameIds?.has(gameId) ?? false;
}
