import api from "@/api/client";
import type { CollectionGame, CollectionListResponse, CollectionStatus } from "@/types/collection";

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
  const response = await api.get<CollectionListResponse>(`/users/${userId}/collection`, {
    params: status ? { status } : undefined,
    signal,
  });

  if (!response.data || !Array.isArray(response.data.games)) {
    throw new Error("Unexpected response format from GET /api/users/{id}/collection");
  }

  return response.data.games;
}
