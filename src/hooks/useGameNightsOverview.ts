"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorInfo, type ApiErrorInfo } from "@/api/errors";
import { getGameNightMembers, getGameNights, updateRsvp } from "@/api/game-nights";
import { useAuth } from "@/auth/useAuth";
import { mapSettledWithConcurrency } from "@/lib/concurrency";
import {
  applyRsvpStatus,
  describeRsvpError,
  type MembersState,
  type OverviewEntry,
} from "@/lib/game-nights/overview";
import type { GameNightResponse, RsvpUpdate } from "@/types/game-night";

/** The backend has no batch members endpoint, so requests are limited to a few at a time. */
const MEMBERS_CONCURRENCY = 4;

type ListState =
  | { status: "loading" }
  | { status: "error"; error: ApiErrorInfo }
  | { status: "success"; gameNights: GameNightResponse[] };

export type RsvpAnswer = RsvpUpdate["status"];

export type RsvpResult =
  | { ok: true; status: RsvpAnswer | "pending"; gameNight: GameNightResponse }
  | { ok: false; message: string; removed: boolean };

/**
 * Loads the user's game nights and each night's members (for the RSVP status and attendees),
 * and answers invitations.
 *
 * The page shows a loading state until the list and the first members requests have settled,
 * so cards don't jump between tabs while statuses arrive. Responses that arrive after a
 * reload, logout or unmount are ignored.
 */
export function useGameNightsOverview() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [list, setList] = useState<ListState>({ status: "loading" });
  const [members, setMembers] = useState<Record<number, MembersState>>({});
  const [pendingRsvp, setPendingRsvp] = useState<Record<number, RsvpAnswer>>({});
  const [rsvpErrors, setRsvpErrors] = useState<Record<number, string>>({});
  const [attempt, setAttempt] = useState(0);

  // Bumped whenever the data's owner or lifetime changes, so late responses are dropped.
  const generation = useRef(0);
  const lifetime = useRef<AbortController | null>(null);
  const rsvpInFlight = useRef(new Set<number>());
  // Latest request per night, so an older members response can't overwrite a newer one.
  const membersRequest = useRef(new Map<number, number>());

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    const generationRef = generation;
    const current = ++generationRef.current;
    lifetime.current = controller;
    rsvpInFlight.current.clear();
    membersRequest.current.clear();

    (async () => {
      try {
        const gameNights = await getGameNights(controller.signal);
        const results = await mapSettledWithConcurrency(
          gameNights,
          MEMBERS_CONCURRENCY,
          (gameNight) => getGameNightMembers(gameNight.id, controller.signal),
          controller.signal,
        );
        if (current !== generation.current) return;

        const next: Record<number, MembersState> = {};
        gameNights.forEach((gameNight, index) => {
          const result = results[index];
          next[gameNight.id] =
            result.status === "fulfilled"
              ? { status: "success", members: result.value }
              : { status: "error" };
        });
        setMembers(next);
        setList({ status: "success", gameNights });
      } catch (error: unknown) {
        const info = getApiErrorInfo(error);
        if (controller.signal.aborted || info.kind === "canceled" || current !== generation.current) {
          return;
        }
        setList({ status: "error", error: info });
      }
    })();

    return () => {
      generationRef.current++;
      controller.abort();
    };
  }, [userId, attempt]);

  /** Full reload with the page loading state (the Try Again button). */
  const reload = useCallback(() => {
    setList({ status: "loading" });
    setPendingRsvp({});
    setRsvpErrors({});
    setAttempt((value) => value + 1);
  }, []);

  /** (Re)loads one night's members. With `quiet`, a failure keeps what was shown before. */
  const loadMembers = useCallback(async (gameNightId: number, quiet = false) => {
    const current = generation.current;
    const signal = lifetime.current?.signal;
    const request = (membersRequest.current.get(gameNightId) ?? 0) + 1;
    membersRequest.current.set(gameNightId, request);
    const isLatest = () =>
      current === generation.current && membersRequest.current.get(gameNightId) === request;

    if (!quiet) setMembers((prev) => ({ ...prev, [gameNightId]: { status: "loading" } }));

    try {
      const loaded = await getGameNightMembers(gameNightId, signal);
      if (!isLatest()) return;
      setMembers((prev) => ({ ...prev, [gameNightId]: { status: "success", members: loaded } }));
    } catch (error: unknown) {
      if (!isLatest() || getApiErrorInfo(error).kind === "canceled" || quiet) return;
      setMembers((prev) => ({ ...prev, [gameNightId]: { status: "error" } }));
    }
  }, []);

  /** Re-fetches the list without the full-page loading state; drops nights that are gone. */
  const refreshListQuietly = useCallback(async () => {
    const current = generation.current;
    try {
      const gameNights = await getGameNights(lifetime.current?.signal);
      if (current !== generation.current) return;
      setList({ status: "success", gameNights });
      await Promise.all(gameNights.map((gameNight) => loadMembers(gameNight.id, true)));
    } catch {
      // Keep showing the current list; the card already shows the RSVP error.
    }
  }, [loadMembers]);

  const respond = useCallback(
    async (gameNight: GameNightResponse, answer: RsvpAnswer): Promise<RsvpResult | null> => {
      if (userId === null || rsvpInFlight.current.has(gameNight.id)) return null;

      const current = generation.current;
      rsvpInFlight.current.add(gameNight.id);
      setPendingRsvp((prev) => ({ ...prev, [gameNight.id]: answer }));
      setRsvpErrors(({ [gameNight.id]: _cleared, ...rest }) => rest);

      const finish = () => {
        rsvpInFlight.current.delete(gameNight.id);
        setPendingRsvp(({ [gameNight.id]: _done, ...rest }) => rest);
      };

      try {
        const saved = await updateRsvp(gameNight.id, answer);
        if (current !== generation.current) return null;

        // Show the saved status right away, then re-check counts in the background.
        setMembers((prev) => {
          const state = prev[gameNight.id];
          if (state?.status !== "success") return prev;
          return {
            ...prev,
            [gameNight.id]: {
              status: "success",
              members: applyRsvpStatus(state.members, userId, saved.status),
            },
          };
        });
        finish();
        void loadMembers(gameNight.id, true);
        return { ok: true, status: saved.status, gameNight };
      } catch (error: unknown) {
        if (current !== generation.current) return null;
        const { message, refresh } = describeRsvpError(getApiErrorInfo(error), answer);
        finish();
        if (!message) return null;

        setRsvpErrors((prev) => ({ ...prev, [gameNight.id]: message }));
        if (refresh === "list") void refreshListQuietly();
        if (refresh === "members") void loadMembers(gameNight.id, true);
        return { ok: false, message, removed: refresh === "list" };
      }
    },
    [userId, loadMembers, refreshListQuietly],
  );

  const entries = useMemo<OverviewEntry[] | null>(() => {
    if (list.status !== "success") return null;
    return list.gameNights.map((gameNight) => ({
      gameNight,
      members: members[gameNight.id] ?? { status: "loading" },
    }));
  }, [list, members]);

  return {
    userId,
    list,
    entries,
    pendingRsvp,
    rsvpErrors,
    reload,
    retryMembers: loadMembers,
    respond,
  };
}
