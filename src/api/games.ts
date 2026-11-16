import api from "@/api/client";
import type { GameListResponse } from "@/types/game";

export interface GetGamesParams {
  page?: number;
  /** Backend allows 1–100, default 20. */
  limit?: number;
}

/** GET /api/games */
export async function getGames(
  params: GetGamesParams = {},
  signal?: AbortSignal,
): Promise<GameListResponse> {
  const response = await api.get<GameListResponse>("/games", { params, signal });

  // Guard against non-JSON responses (e.g. an HTML page when the API isn't reachable
  // behind the same host in production) so they surface as errors, not a blank grid.
  if (!response.data || !Array.isArray(response.data.games)) {
    throw new Error("Unexpected response format from GET /api/games");
  }

  return response.data;
}
