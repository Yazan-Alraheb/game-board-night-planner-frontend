"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import * as collectionApi from "@/api/collection";
import { getGame } from "@/api/games";
import { useAuth } from "@/auth/useAuth";
import {
  GameCollectionStatus,
  collectionStatusScope,
  readCollectionStatus,
  type CollectionStatusState,
} from "@/lib/games/collection-status";
import { gameScope } from "@/lib/games/game-details";
import {
  NightResource,
  readNightResource,
  type Resource,
} from "@/lib/game-nights/night-resource";
import type { CollectionStatus } from "@/types/collection";
import type { Game } from "@/types/game";

/**
 * Loads one public game. Reuses the id-scoped request bookkeeping of the game night pages:
 * data for a previous game id reads as loading, older responses can't write and requests
 * are aborted when the id changes or the page unmounts.
 */
export function useGame(gameId: number | null): { game: Resource<Game>; retry: () => void } {
  const [resource] = useState(() => new NightResource(getGame));
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  const scope = gameScope(gameId);

  useEffect(() => {
    if (scope === null || gameId === null) return;
    resource.open(scope, gameId);
    return () => resource.close();
  }, [resource, scope, gameId]);

  const retry = useCallback(() => void resource.load(scope), [resource, scope]);

  return { game: readNightResource(snapshot, scope), retry };
}

export type GameCollectionView = CollectionStatusState | { status: "signed-out" };

/**
 * The signed-in user's saved status for one game, with the actions that change it.
 * Signed-out visitors get `{ status: "signed-out" }` and no request is made.
 */
export function useGameCollectionStatus(gameId: number | null): {
  collection: GameCollectionView;
  save: (status: CollectionStatus) => void;
  remove: () => void;
  retry: () => void;
} {
  const { session, ready } = useAuth();
  const userId = session?.user.id ?? null;

  const [store] = useState(() => new GameCollectionStatus(collectionApi));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const scope = collectionStatusScope(userId, gameId);

  useEffect(() => {
    if (scope === null || userId === null || gameId === null) return;
    store.open(scope, userId, gameId);
    return () => store.close();
  }, [store, scope, userId, gameId]);

  const save = useCallback((status: CollectionStatus) => void store.save(status), [store]);
  const remove = useCallback(() => void store.remove(), [store]);
  const retry = useCallback(() => void store.retry(), [store]);

  let collection: GameCollectionView;
  if (!ready) collection = { status: "loading" };
  else if (userId === null) collection = { status: "signed-out" };
  else collection = readCollectionStatus(snapshot, scope);

  return { collection, save, remove, retry };
}
