/**
 * Data types for games and game nights.
 *
 * `Game` and `GameListResponse` match the backend's GameResponse and
 * GameListResponse schemas (checked against GET /api/games and /openapi.json).
 */

export interface UserSummary {
  id: number;
  display_name: string;
  avatar_url: string | null;
}

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

/** The current user's relationship to a game night. */
export type GameNightRole = "host" | "invited";

/**
 * PROVISIONAL: does not match the backend yet. The backend's GameNightResponse
 * uses `name` and `host_id`, and members come from GET /api/game-nights/{id}/members.
 * Align this when the homepage loads real game nights.
 */
export interface GameNight {
  id: number;
  title: string;
  /** ISO 8601 date-time string */
  starts_at: string;
  location: string;
  my_role: GameNightRole;
  attendees: UserSummary[];
}
