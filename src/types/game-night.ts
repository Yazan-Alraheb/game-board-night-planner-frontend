/**
 * Game night types that match the FastAPI backend.
 *
 * Checked against the live /openapi.json and the backend source
 * (GameNightResponse, GameNightListResponse, GameNightMemberEntry, GameNightMembersResponse).
 * `starts_at` / `created_at` are timezone-aware UTC strings.
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

/** Backend schema: RSVPUpdate (PUT /api/game-nights/{id}/rsvp). Only the invitee's own answer. */
export interface RsvpUpdate {
  status: Exclude<GameNightMemberStatus, "pending">;
}

/** Backend schema: RSVPResponse */
export interface RsvpResponse {
  game_night_id: number;
  status: GameNightMemberStatus;
}

/**
 * Backend schema: GameNightUpdate (PUT /api/game-nights/{id}). Host only.
 * A full replacement of these four fields; extra keys are rejected with 422.
 * `starts_at` must include a timezone offset (pydantic AwareDatetime).
 */
export interface GameNightUpdate {
  name: string;
  starts_at: string;
  location: string;
  notes: string | null;
}

/**
 * Backend schema: GameNightCreate (POST /api/game-nights). Extra keys are rejected with 422.
 * `game_ids` must be games the host owns; `invitee_ids` must be accepted friends.
 */
export interface GameNightCreate {
  name: string;
  starts_at: string;
  location: string;
  notes: string | null;
  game_ids: number[];
  invitee_ids: number[];
}

/** Backend schema: GameNightInvite (POST /api/game-nights/{id}/members). Host only. */
export interface GameNightInvite {
  user_id: number;
}

/** Backend schema: GameNightMemberResponse */
export interface GameNightMemberResponse {
  member: GameNightMember;
}
