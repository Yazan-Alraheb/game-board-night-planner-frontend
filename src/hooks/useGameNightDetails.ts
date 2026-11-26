"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ApiErrorInfo } from "@/api/errors";
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
import {
  NightResource,
  nightResourceScope,
  readNightResource,
  type NightFetcher,
  type Resource,
  type UpdateRefetch,
} from "@/lib/game-nights/night-resource";
import { applyRsvpStatus } from "@/lib/game-nights/overview";
import type {
  GameNightAvailableGame,
  GameNightMember,
  GameNightUpdate,
  RsvpResponse,
  RsvpUpdate,
} from "@/types/game-night";
import type { PublicUser } from "@/types/friend";

export type { Resource };

/**
 * One resource of the night, loaded from `fetcher(nightId)` for the signed-in user.
 * The request bookkeeping lives in NightResource (see lib/game-nights/night-resource.ts):
 * - Data is scoped to user + night, so another user's or night's data is never shown.
 * - Only the newest request may write; a confirmed local change counts as newer.
 * - Requests are aborted when the user or night changes, on sign-out and on unmount.
 */
function useNightResource<T>(
  scope: string | null,
  nightId: number | null,
  fetcher: NightFetcher<T>,
) {
  // The fetchers are module-level API functions, so one instance per mounted hook is enough.
  const [resource] = useState(() => new NightResource(fetcher));
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);

  useEffect(() => {
    if (scope === null || nightId === null) return;
    resource.open(scope, nightId);
    return () => resource.close();
  }, [resource, scope, nightId]);

  /** Reloads. Without `quiet` the loading state is shown meanwhile (a Retry button). */
  const load = useCallback((quiet = false) => resource.load(scope, quiet), [resource, scope]);

  /** Applies a server-confirmed change to loaded data; older GETs can no longer overwrite it. */
  const update = useCallback(
    (change: (data: T) => T, refetch?: UpdateRefetch) => resource.update(scope, change, refetch),
    [resource, scope],
  );

  const fail = useCallback((error: ApiErrorInfo) => resource.fail(scope, error), [resource, scope]);

  return { value: readNightResource(snapshot, scope), load, update, fail };
}

export type MutationResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * Loads a game night with its members and games, and runs its actions.
 *
 * The three GETs run in parallel and fail independently, so the page stays usable when
 * members or games can't be loaded. Each action runs at most once at a time per kind;
 * a second call while one is in flight returns null. Results for a night the user has
 * navigated away from, or that finish after the signed-in user changed, also return null.
 */
export function useGameNightDetails(id: number | null) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  // User + night: data and action results only ever apply to the scope they were started in.
  const scope = nightResourceScope(userId, id);

  const event = useNightResource(scope, id, getGameNight);
  const members = useNightResource(scope, id, getGameNightMembers);
  const games = useNightResource(scope, id, getGameNightGames);

  // The scope the page currently shows; actions that finish for another user or night are ignored.
  const activeScope = useRef<string | null>(null);
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    activeScope.current = scope;
    const flights = inFlight.current;
    return () => {
      activeScope.current = null;
      flights.clear();
    };
  }, [scope]);

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
      const runScope = scope;
      if (nightId === null || runScope === null || inFlight.current.has(key)) return null;
      inFlight.current.add(key);
      try {
        const value = await action(nightId);
        return activeScope.current === runScope ? { ok: true, value } : null;
      } catch (error: unknown) {
        return activeScope.current === runScope ? { ok: false, error } : null;
      } finally {
        if (activeScope.current === runScope) inFlight.current.delete(key);
      }
    },
    [id, scope],
  );

  const save = useCallback(
    async (payload: GameNightUpdate) => {
      const result = await run("save", (nightId) => updateGameNight(nightId, payload));
      // The PUT returns the complete night, so there is nothing left to re-check.
      if (result?.ok) event.update(() => result.value, "never");
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
        // An RSVP change can unselect games only this user owned; re-check both quietly.
        // "always" makes the update itself re-fetch members, so no second members GET is needed.
        members.update((list) => applyRsvpStatus(list, userId, result.value.status), "always");
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
