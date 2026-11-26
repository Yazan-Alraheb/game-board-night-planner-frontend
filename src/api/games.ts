import api from "@/api/client";
import type { Game, GameListResponse } from "@/types/game";

export interface GetGamesParams {
  search?: string;
  players?: number;
  category?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  playtime?: number;
  page?: number;
  limit?: number;
}

// Retrieves games with optional filters.
export async function getGames(
  params: GetGamesParams = {},
  signal?: AbortSignal,
): Promise<GameListResponse> {
  const response = await api.get<GameListResponse>(
    "/games",
    { params, signal },
  );

  if (!response.data || !Array.isArray(response.data.games)) {
    throw new Error(
      "Unexpected response format from GET /api/games",
    );
  }

  return response.data;
}

// Retrieves one specific game.
export async function getGame(
  id: number,
  signal?: AbortSignal,
): Promise<Game> {
  const response = await api.get<{ game: Game }>(
    `/games/${id}`,
    { signal },
  );

  return response.data.game;
}

// Limits category loading to a reasonable number of requests.
const MAX_CATEGORY_PAGES = 10;
const CATEGORY_PAGE_SIZE = 100;

// Gets unique categories from the games returned by the backend.
export async function getGameCategories(
  signal?: AbortSignal,
): Promise<string[]> {
  // Stores lowercase keys while preserving original capitalization.
  const categories = new Map<string, string>();

  for (let page = 1; page <= MAX_CATEGORY_PAGES; page++) {
    const { games, total } = await getGames(
      {
        page,
        limit: CATEGORY_PAGE_SIZE,
      },
      signal,
    );

    for (const game of games) {
      for (const category of game.categories ?? []) {
        const trimmed = category.trim();
        const key = trimmed.toLowerCase();

        if (trimmed && !categories.has(key)) {
          categories.set(key, trimmed);
        }
      }
    }

    // Stop when there are no more pages.
    if (
      games.length === 0 ||
      page * CATEGORY_PAGE_SIZE >= total
    ) {
      break;
    }
  }

  // Return categories alphabetically.
  return [...categories.values()].sort((a, b) =>
    a.localeCompare(b),
  );
}