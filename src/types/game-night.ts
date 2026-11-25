import type { PublicUser } from "@/types/friend";

/**
 * Game night types that match the FastAPI backend.
 *
 * Checked against the live /openapi.json and the backend source
 * (GameNightResponse, GameNightListResponse, GameNightMemberEntry, GameNightMembersResponse).
 * `starts_at` / `created_at` are timezone-aware UTC strings.
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

/** Backend enum for a member's RSVP. The host is stored as an "accepted" member. */
export type GameNightMemberStatus = "pending" | "accepted" | "declined";

/** Backend schema: GameNightMemberEntry */
export interface GameNightMember {
  user: PublicUser;
  status: GameNightMemberStatus;
}

/** Backend schema: GameNightMembersResponse (GET /api/game-nights/{id}/members) */
export interface GameNightMembersResponse {
  members: GameNightMember[];
}
