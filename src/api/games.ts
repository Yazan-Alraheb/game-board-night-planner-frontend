import api from "@/api/client";
import type { GameListResponse } from "@/types/game";


export interface GetGamesParams {
  // Searches the game name or description.
  search?: string;

  // Finds games that support this number of players.
  players?: number;

  // Filters by game category.
  category?: string;

  // Filters by Easy, Medium, or Hard.
  difficulty?: "Easy" | "Medium" | "Hard";

  // Finds games that take this many minutes or less.
  playtime?: number;

  // Selects which page to retrieve.
  page?: number;

  // Controls how many games appear per page.
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
