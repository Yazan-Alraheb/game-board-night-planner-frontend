/**
 * Pure helpers for the Game Details page (/games/[id]).
 *
 * GET /api/games/{id} is public and returns 404 for an unknown game (checked against /openapi.json).
 */
import type { ApiErrorInfo } from "@/api/errors";

/** The `[id]` route segment as a positive integer, or null for anything else ("abc", "1.5", "-3"). */
export function parseGameId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

/** Scope for the game resource: one per game id, so another game's data is never shown. */
export function gameScope(gameId: number | null): string | null {
  return gameId === null ? null : `game:${gameId}`;
}

export type GameLoadFailure =
  | { kind: "not_found" }
  | { kind: "retryable"; message: string };

/**
 * How to present a failed game request. Only a real HTTP 404 means "Game not found";
 * everything else (offline, timeout, 5xx, unexpected response) can be retried.
 */
export function describeGameLoadError(error: ApiErrorInfo): GameLoadFailure {
  switch (error.kind) {
    case "not_found":
      return { kind: "not_found" };
    case "network":
      return {
        kind: "retryable",
        message: "We couldn't reach the server. Check your connection and try again.",
      };
    case "server":
      return {
        kind: "retryable",
        message: "The server had a problem loading this game. Please try again.",
      };
    default:
      return { kind: "retryable", message: "Something went wrong while loading this game. Please try again." };
  }
}

/** Message for a failed collection lookup (the page itself still shows the game). */
export function describeCollectionLoadError(error: ApiErrorInfo): string {
  return error.kind === "network"
    ? "We couldn't reach the server to check your collection."
    : "We couldn't check whether this game is in your collection.";
}
