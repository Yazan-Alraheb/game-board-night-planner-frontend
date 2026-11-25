/**
 * Data types for games.
 *
 * `Game` and `GameListResponse` match the backend's GameResponse and
 * GameListResponse schemas (checked against GET /api/games and /openapi.json).
 */

/** Backend schema: GameResponse */
export interface Game {
  id: number;
  name: string;
  description: string | null;
  minimum_players: number;
  maximum_players: number;
  /** Minutes */
  playtime: number;
  difficulty: string;
  categories: string[];
  /** Root-relative path to a file in public/, e.g. "/images/games/catan.jpg" */
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  instructions: string | null;
}

/** Backend schema: GameListResponse (GET /api/games) */
export interface GameListResponse {
  games: Game[];
  total: number;
  page: number;
}

