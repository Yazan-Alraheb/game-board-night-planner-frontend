import api from "@/api/client";
import type {
  CollectionGame,
  CollectionListResponse,
  CollectionStatus,
} from "@/types/collection";

export type { CollectionGame, CollectionStatus };

/** Older name for CollectionGame, kept so existing imports still work. */
export type CollectionEntry = CollectionGame;

/**
 * GET /api/users/{id}/collection
 * The backend only allows a user to read their own collection (403 otherwise).
 * `status` filters on the server; omit it to get owned and wishlist games.
 */
export async function getCollection(
  userId: number,
  status?: CollectionStatus,
  signal?: AbortSignal,
): Promise<CollectionGame[]> {
  const response = await api.get<CollectionListResponse>(
    `/users/${userId}/collection`,
    {
      params: status ? { status } : undefined,
      signal,
    },
  );

  if (!response.data || !Array.isArray(response.data.games)) {
    throw new Error(
      "Unexpected response format from GET /api/users/{id}/collection",
    );
  }

  return response.data.games;
}

/** POST /api/users/{id}/collection. 409 if the game is already saved. */
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

/** PUT /api/users/{id}/collection/{game_id}: switch between owned and wishlist. 404 if not saved. */
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

/** DELETE /api/users/{id}/collection/{game_id}. 404 if not saved. */
export async function removeFromCollection(
  userId: number,
  gameId: number,
) {
  await api.delete(`/users/${userId}/collection/${gameId}`);
}
