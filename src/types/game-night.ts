/**
 * Game night types that match the FastAPI backend.
 *
 * Checked against the live /openapi.json (GameNightResponse, GameNightListResponse).
 * The older `GameNight` type in src/types/game.ts is a provisional homepage mock shape
 * and is intentionally left unchanged.
 */

import type { PublicUser } from "@/types/friend";
import type { Game } from "@/types/game";

/** Backend schema: GameNightResponse */
export interface GameNightResponse {
  id: number;
  host_id: number;
  name: string;
  /** ISO 8601 date-time */
  starts_at: string;
  location: string;
  notes: string | null;
  /** ISO 8601 date-time */
  created_at: string;
}

/** Backend schema: GameNightListResponse (GET /api/game-nights) */
export interface GameNightListResponse {
  game_nights: GameNightResponse[];
}

/** Backend schema: GameNightDetailResponse (GET /api/game-nights/{id}) */
export interface GameNightDetailResponse {
  game_night: GameNightResponse;
}

/** Backend schema: GameNightAvailableGame (GET /api/game-nights/{id}/games) */
export interface GameNightAvailableGame {
  game: Game;
  owners: PublicUser[];
  /** True when the game is already selected for the event. */
  selected: boolean;
}

/** Backend schema: GameNightAvailableGamesResponse */
export interface GameNightAvailableGamesResponse {
  games: GameNightAvailableGame[];
}

/** Backend schema: GameNightGameResponse (POST /api/game-nights/{id}/games) */
export interface GameNightGameResponse {
  game_id: number;
  game_night_id: number;
}
