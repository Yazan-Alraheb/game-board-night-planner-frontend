"use client";

import { useCallback, useRef, useState } from "react";
import { addGameToGameNight, getSelectedGameIds } from "@/api/game-nights";
import { getApiErrorInfo } from "@/api/errors";
import { useLazyResource } from "@/hooks/useLazyResource";
import { classifyAddFailure } from "@/lib/recommendations/add-to-game-night";

export type AddGameStatus =
  /** The event's selected games are still loading: adding is not possible yet. */
  | { state: "checking" }
  /** The selected games couldn't be loaded: adding is blocked until a retry succeeds. */
  | { state: "unavailable" }
  | { state: "idle" }
  | { state: "adding" }
  /** Added just now. */
  | { state: "added" }
  /** Already selected for the event (known up front or a 409). */
  | { state: "already" }
  /** This game only. `retryable: false` keeps the button disabled. */
  | { state: "error"; message: string; retryable: boolean };

/** Status of the "which games are already selected" check. */
export type SelectedGamesStatus = "idle" | "loading" | "ready" | "error";

/**
 * Adding recommended games to the selected game night (host only; see Recommendations.tsx).
 *
 * - Adding stays disabled until the event's already-selected games have loaded, so
 *   games already in the event are never offered as "Add".
 * - Failures are classified per game. Only the backend's host-only 403 disables adding
 *   for the whole event; a game-specific 403 stays on that game's card.
 * - A game can't be submitted twice while a request is in flight.
 *
 * Pass `null` to turn the hook off (no requests), e.g. for guests or personal mode.
 */
export function useAddToGameNight(gameNightId: number | null) {
  const fetchSelected = useCallback(
    (signal: AbortSignal) => getSelectedGameIds(gameNightId ?? 0, signal),
    [gameNightId],
  );
  const [selected, retrySelected] = useLazyResource(fetchSelected, gameNightId !== null);

  const [statuses, setStatuses] = useState<Record<number, AddGameStatus>>({});
  const [eventError, setEventError] = useState<string | null>(null);
  // Synchronous guard against double clicks before React re-renders.
  const inFlight = useRef(new Set<number>());

  const selectedStatus: SelectedGamesStatus =
    selected.status === "success" ? "ready" : selected.status === "error" ? "error" : selected.status;

  const statusFor = useCallback(
    (gameId: number): AddGameStatus => {
      const local = statuses[gameId];
      if (local && local.state !== "idle") return local;
      if (selected.status === "success") {
        return selected.data.has(gameId) ? { state: "already" } : { state: "idle" };
      }
      return selected.status === "error" ? { state: "unavailable" } : { state: "checking" };
    },
    [statuses, selected],
  );

  const add = useCallback(
    async (gameId: number) => {
      if (gameNightId === null || eventError !== null) return;
      if (selected.status !== "success" || selected.data.has(gameId)) return;
      const current = statuses[gameId]?.state;
      if (current === "adding" || current === "added" || current === "already") return;
      if (inFlight.current.has(gameId)) return;

      inFlight.current.add(gameId);
      setStatuses((previous) => ({ ...previous, [gameId]: { state: "adding" } }));
      try {
        await addGameToGameNight(gameNightId, gameId);
        setStatuses((previous) => ({ ...previous, [gameId]: { state: "added" } }));
      } catch (error: unknown) {
        const failure = classifyAddFailure(getApiErrorInfo(error));
        let status: AddGameStatus;
        if (failure.scope === "already") {
          status = { state: "already" };
        } else if (failure.scope === "event") {
          setEventError(failure.message);
          status = { state: "idle" };
        } else {
          status = { state: "error", message: failure.message, retryable: failure.retryable };
        }
        setStatuses((previous) => ({ ...previous, [gameId]: status }));
      } finally {
        inFlight.current.delete(gameId);
      }
    },
    [gameNightId, eventError, selected, statuses],
  );

  return {
    statusFor,
    add,
    /** Set when the backend says this user can't add games to the event at all. */
    eventError,
    selectedStatus,
    retrySelected,
  };
}
