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

/** Safety cap so a very large catalog can't trigger an unbounded number of requests. */
const MAX_CATEGORY_PAGES = 10;
const CATEGORY_PAGE_SIZE = 100;

/**
 * Unique game categories from the catalog (GET /api/games), sorted alphabetically.
 * The backend has no categories endpoint, so they are collected from the games.
 */
export async function getGameCategories(signal?: AbortSignal): Promise<string[]> {
  const categories = new Map<string, string>(); // lower-case key → original spelling

  for (let page = 1; page <= MAX_CATEGORY_PAGES; page++) {
    const { games, total } = await getGames({ page, limit: CATEGORY_PAGE_SIZE }, signal);

    for (const game of games) {
      for (const category of game.categories ?? []) {
        const trimmed = category.trim();
        const key = trimmed.toLowerCase();
        if (trimmed && !categories.has(key)) categories.set(key, trimmed);
      }
    }

    if (games.length === 0 || page * CATEGORY_PAGE_SIZE >= total) break;
  }

  return [...categories.values()].sort((a, b) => a.localeCompare(b));
}
