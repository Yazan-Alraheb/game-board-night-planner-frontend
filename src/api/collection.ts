import api from "@/api/client";
import type { Game } from "@/types/game";

export type CollectionStatus = "owned" | "wishlist";

export interface CollectionEntry {
  game: Game;
  status: CollectionStatus;
}

export async function getCollection(
  userId: number,
  signal?: AbortSignal,
): Promise<CollectionEntry[]> {
  const response = await api.get<{ games: CollectionEntry[] }>(
    `/users/${userId}/collection`,
    { signal },
  );

  return response.data.games;
}

export async function addToCollection(
  userId: number,
  gameId: number,
  status: CollectionStatus,
) {
  const response = await api.post(`/users/${userId}/collection`, {
    game_id: gameId,
    status,
  });

  return response.data;
}

// change a game between owned and the wishlist
export async function updateCollectionStatus(
  userId: number,
  gameId: number,
  status: CollectionStatus,
) {
  const response = await api.put(
    `/users/${userId}/collection/${gameId}`,
    { status },
  );

  return response.data;
}

// Removes a game from the users collection
export async function removeFromCollection(
  userId: number,
  gameId: number,
) {
  await api.delete(`/users/${userId}/collection/${gameId}`);
}