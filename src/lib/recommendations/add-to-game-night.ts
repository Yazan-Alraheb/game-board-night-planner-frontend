/**
 * Decisions for "Add to game night" on the recommendations page.
 *
 * Pure functions, so they can be tested without React. The backend stays the source of
 * truth: these only decide what to SHOW. Every add is still authorized by
 * POST /api/game-nights/{id}/games.
 */
import type { ApiErrorInfo } from "@/api/errors";
import type { LazyResource } from "@/hooks/useLazyResource";
import type { GameNightResponse } from "@/types/game-night";

// ---------------------------------------------------------------------------
// Who sees Add controls
// ---------------------------------------------------------------------------

export type AddControlsAccess =
  /** Event details still loading: show no controls yet (avoids flashing them for guests). */
  | { kind: "checking" }
  /** The current user hosts the event; the backend only lets the host add games. */
  | { kind: "host" }
  /** Accepted guest: can see recommendations but can't add games. */
  | { kind: "guest" }
  /** Event details failed to load, so hosting can't be confirmed: no controls, offer a retry. */
  | { kind: "unknown" };

export function resolveAddControlsAccess(
  gameNight: LazyResource<GameNightResponse>,
  userId: number,
): AddControlsAccess {
  switch (gameNight.status) {
    case "idle":
    case "loading":
      return { kind: "checking" };
    case "error":
      return { kind: "unknown" };
    case "success":
      return gameNight.data.host_id === userId ? { kind: "host" } : { kind: "guest" };
  }
}

// ---------------------------------------------------------------------------
// What a failed add means
// ---------------------------------------------------------------------------

/**
 * The backend's `detail` for the host-only rule (ensure_host in game_nights.py).
 * Only this exact 403 is treated as event-wide; any other 403 stays on that game's card.
 */
export const HOST_ONLY_DETAIL = "Only the host can perform this action";

export type AddFailure =
  /** Already selected for the event (409). Shown as success, not as an error. */
  | { scope: "already" }
  /** Affects every game: the user can't add to this event at all. */
  | { scope: "event"; message: string }
  /** Affects only this game. `retryable` says whether trying again can help. */
  | { scope: "game"; message: string; retryable: boolean };

export function classifyAddFailure(error: ApiErrorInfo): AddFailure {
  switch (error.kind) {
    case "conflict":
      return { scope: "already" };
    case "forbidden":
      if (error.detail === HOST_ONLY_DETAIL) {
        return { scope: "event", message: "Only the host can add games to this game night." };
      }
      // e.g. "Game is not owned by an accepted attendee": the owner removed the game
      // from their collection or left the event after the results were made.
      return {
        scope: "game",
        message:
          "This game can't be added. Its owner may have removed it from their collection or left the game night.",
        retryable: false,
      };
    case "unauthorized":
      return { scope: "game", message: "Your session has expired. Please log in again.", retryable: false };
    case "not_found":
      return { scope: "game", message: "This game night or game no longer exists.", retryable: false };
    case "bad_request":
    case "validation":
      return { scope: "game", message: "This game couldn't be added to the game night.", retryable: false };
    case "network":
      return {
        scope: "game",
        message: "Couldn't reach the server. Check your connection and try again.",
        retryable: true,
      };
    default:
      return {
        scope: "game",
        message: "Something went wrong while adding the game. Please try again.",
        retryable: true,
      };
  }
}
