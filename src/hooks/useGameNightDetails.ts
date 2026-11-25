"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorInfo, type ApiErrorInfo } from "@/api/errors";
import {
  addGameToGameNight,
  deleteGameNight,
  getGameNight,
  getGameNightGames,
  getGameNightMembers,
  inviteToGameNight,
  leaveGameNight,
  removeGameFromGameNight,
  updateGameNight,
  updateRsvp,
} from "@/api/game-nights";
import { useAuth } from "@/auth/useAuth";
import { setGameSelected } from "@/lib/game-nights/details";
import { applyRsvpStatus } from "@/lib/game-nights/overview";
import type {
  GameNightAvailableGame,
  GameNightMember,
  GameNightUpdate,
  RsvpResponse,
  RsvpUpdate,
} from "@/types/game-night";
import type { PublicUser } from "@/types/friend";

export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiErrorInfo }
  | { status: "success"; data: T };

const LOADING = { status: "loading" } as const;

/**
 * One resource of the night, loaded from `fetcher(id)`.
 * - The state remembers which id it belongs to, so a new id never shows the old night's data.
 * - Only the latest request may write, so an older response can't overwrite a newer one.
 * - Requests are aborted when the id changes or the page unmounts.
 */
function useNightResource<T>(
  id: number | null,
  enabled: boolean,
  fetcher: (id: number, signal?: AbortSignal) => Promise<T>,
) {
  const [state, setState] = useState<{ forId: number | null; value: Resource<T> }>({
    forId: null,
    value: LOADING,
  });
  const generation = useRef(0);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);

  /**
   * Fetches and stores the result; only the latest request may write.
   * With `quiet`, a failure keeps the data already shown, except when the night is gone.
   */
  const fetchLatest = useCallback(
    async (quiet: boolean) => {
      if (id === null) return;
      const current = generation.current;
      const requestId = ++request.current;
      const isLatest = () => current === generation.current && requestId === request.current;

      try {
        const data = await fetcher(id, controller.current?.signal);
        if (isLatest()) setState({ forId: id, value: { status: "success", data } });
      } catch (error: unknown) {
        const info = getApiErrorInfo(error);
        if (!isLatest() || info.kind === "canceled") return;
        if (quiet && info.kind !== "not_found") return;
        setState({ forId: id, value: { status: "error", error: info } });
      }
    },
    [id, fetcher],
  );

  /** Reloads. Without `quiet` the loading state is shown meanwhile (a Retry button). */
  const load = useCallback(
    async (quiet = false) => {
      if (id === null) return;
      if (!quiet) setState({ forId: id, value: LOADING });
      await fetchLatest(quiet);
    },
    [id, fetchLatest],
  );

  useEffect(() => {
    if (!enabled || id === null) return;
    const abort = new AbortController();
    const generationRef = generation;
    generationRef.current++;
    controller.current = abort;
    // A new id already reads as loading (state.forId differs), so no state reset is needed here.
    void fetchLatest(false);
    return () => {
      generationRef.current++;
      abort.abort();
    };
  }, [enabled, id, fetchLatest]);

  /** Applies a server-confirmed change to loaded data. */
  const update = useCallback(
    (change: (data: T) => T) => {
      setState((prev) =>
        prev.forId === id && prev.value.status === "success"
          ? { forId: id, value: { status: "success", data: change(prev.value.data) } }
          : prev,
      );
    },
    [id],
  );

  const fail = useCallback(
    (error: ApiErrorInfo) => {
      request.current++; // Drop any response still on its way.
      setState({ forId: id, value: { status: "error", error } });
    },
    [id],
  );

  const value: Resource<T> = state.forId === id ? state.value : LOADING;
  return { value, load, update, fail };
}

export type MutationResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * Loads a game night with its members and games, and runs its actions.
 *
 * The three GETs run in parallel and fail independently, so the page stays usable when
 * members or games can't be loaded. Each action runs at most once at a time per kind;
 * a second call while one is in flight returns null. Results for a night the user has
 * navigated away from also return null.
 */
export function useGameNightDetails(id: number | null) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const enabled = userId !== null;

  const event = useNightResource(id, enabled, getGameNight);
  const members = useNightResource(id, enabled, getGameNightMembers);
  const games = useNightResource(id, enabled, getGameNightGames);

  // The id the page currently shows; actions that finish for another id are ignored.
  const activeId = useRef<number | null>(null);
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    activeId.current = id;
    const flights = inFlight.current;
    return () => {
      activeId.current = null;
      flights.clear();
    };
  }, [id, userId]);

  const reloadAll = useCallback(() => {
    void event.load();
    void members.load();
    void games.load();
  }, [event, members, games]);

  /** Re-checks role-related data quietly, e.g. after a 403. */
  const refreshQuietly = useCallback(() => {
    void event.load(true);
    void members.load(true);
    void games.load(true);
  }, [event, members, games]);

  /** Marks the night as gone (deleted or no longer visible) so the page shows not-found. */
  const markGone = useCallback(() => {
    event.fail({ kind: "not_found", status: 404, detail: null });
  }, [event]);

  const run = useCallback(
    async <T>(key: string, action: (nightId: number) => Promise<T>): Promise<MutationResult<T> | null> => {
      const nightId = id;
      if (nightId === null || inFlight.current.has(key)) return null;
      inFlight.current.add(key);
      try {
        const value = await action(nightId);
        return activeId.current === nightId ? { ok: true, value } : null;
      } catch (error: unknown) {
        return activeId.current === nightId ? { ok: false, error } : null;
      } finally {
        if (activeId.current === nightId) inFlight.current.delete(key);
      }
    },
    [id],
  );

  const save = useCallback(
    async (payload: GameNightUpdate) => {
      const result = await run("save", (nightId) => updateGameNight(nightId, payload));
      if (result?.ok) event.update(() => result.value);
      return result;
    },
    [run, event],
  );

  const remove = useCallback(() => run("delete", (nightId) => deleteGameNight(nightId)), [run]);

  const leave = useCallback(async () => {
    if (userId === null) return null;
    // Always the signed-in user's own id: the page never removes anyone else.
    return run("leave", (nightId) => leaveGameNight(nightId, userId));
  }, [run, userId]);

  const respond = useCallback(
    async (answer: RsvpUpdate["status"]): Promise<MutationResult<RsvpResponse> | null> => {
      if (userId === null) return null;
      const result = await run("rsvp", (nightId) => updateRsvp(nightId, answer));
      if (result?.ok) {
        members.update((list) => applyRsvpStatus(list, userId, result.value.status));
        // An RSVP change can unselect games only this user owned; re-check both quietly.
        void members.load(true);
        void games.load(true);
      }
      return result;
    },
    [run, userId, members, games],
  );

  const invite = useCallback(
    async (friend: PublicUser): Promise<MutationResult<GameNightMember> | null> => {
      const result = await run(`invite:${friend.id}`, (nightId) => inviteToGameNight(nightId, friend.id));
      if (result?.ok) {
        const added = result.value;
        members.update((list) =>
          list.some((member) => member.user.id === added.user.id) ? list : [...list, added],
        );
      }
      return result;
    },
    [run, members],
  );

  const setGame = useCallback(
    async (game: GameNightAvailableGame, selected: boolean) => {
      const result = await run(`game:${game.game.id}`, (nightId) =>
        selected
          ? addGameToGameNight(nightId, game.game.id).then(() => undefined)
          : removeGameFromGameNight(nightId, game.game.id),
      );
      if (result?.ok) games.update((list) => setGameSelected(list, game.game.id, selected));
      return result;
    },
    [run, games],
  );

  return {
    userId,
    event: event.value,
    members: members.value,
    games: games.value,
    reloadAll,
    reloadEvent: event.load,
    reloadMembers: members.load,
    reloadGames: games.load,
    refreshQuietly,
    markGone,
    save,
    remove,
    leave,
    respond,
    invite,
    setGame,
  };
}
