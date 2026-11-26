"use client";

import { getCollection } from "@/api/collection";
import { useUserResource } from "@/hooks/useUserResource";
import { ownedGameIdsFrom } from "@/lib/home/owned-games";

async function loadOwnedGameIds(userId: number, signal: AbortSignal): Promise<ReadonlySet<number>> {
  return ownedGameIdsFrom(await getCollection(userId, "owned", signal));
}

/**
 * IDs of games the signed-in user owns, or null when unknown
 * (signed out, still loading, or the request failed). Never throws.
 */
export function useOwnedGameIds(): ReadonlySet<number> | null {
  const [resource] = useUserResource(loadOwnedGameIds);
  return resource.status === "success" ? resource.data : null;
}
