"use client";

import { getCollection } from "@/api/collection";
import { useUserResource } from "@/hooks/useUserResource";

async function loadOwnedGameIds(userId: number, signal: AbortSignal): Promise<ReadonlySet<number>> {
  const entries = await getCollection(userId, "owned", signal);
  // The server already filters by status; check again so wishlist games are never shown as owned.
  return new Set(entries.filter((entry) => entry.status === "owned").map((entry) => entry.game.id));
}

/**
 * IDs of games the signed-in user owns, or null when unknown
 * (signed out, still loading, or the request failed). Never throws.
 */
export function useOwnedGameIds(): ReadonlySet<number> | null {
  const [resource] = useUserResource(loadOwnedGameIds);
  return resource.status === "success" ? resource.data : null;
}
