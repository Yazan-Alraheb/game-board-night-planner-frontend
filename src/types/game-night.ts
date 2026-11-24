/**
 * Game night types that match the FastAPI backend.
 *
 * Checked against the live /openapi.json (GameNightResponse, GameNightListResponse).
 * The older `GameNight` type in src/types/game.ts is a provisional homepage mock shape
 * and is intentionally left unchanged.
 */

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
