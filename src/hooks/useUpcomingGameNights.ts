"use client";

import { getGameNightMembers, getGameNights } from "@/api/game-nights";
import { useUserResource } from "@/hooks/useUserResource";
import { selectUpcomingGameNights } from "@/lib/home/upcoming-game-nights";
import type { GameNightMember, GameNightResponse } from "@/types/game-night";

/** Matches the two-card homepage layout. */
export const HOMEPAGE_GAME_NIGHT_LIMIT = 2;

export interface UpcomingGameNight {
  gameNight: GameNightResponse;
  /** null when the members request failed; the card still shows the event itself. */
  members: GameNightMember[] | null;
}

export interface UpcomingGameNights {
  shown: UpcomingGameNight[];
  /** All upcoming nights, including ones not shown on the homepage. */
  totalUpcoming: number;
}

/**
 * One list request, then one members request per shown card (the backend has no
 * batch endpoint), so at most 1 + HOMEPAGE_GAME_NIGHT_LIMIT requests.
 * A failed members request only affects its own card.
 */
async function loadUpcomingGameNights(
  _userId: number,
  signal: AbortSignal,
): Promise<UpcomingGameNights> {
  const upcoming = selectUpcomingGameNights(await getGameNights(signal), Date.now());
  const shown = upcoming.slice(0, HOMEPAGE_GAME_NIGHT_LIMIT);

  const members = await Promise.allSettled(
    shown.map((gameNight) => getGameNightMembers(gameNight.id, signal)),
  );

  return {
    totalUpcoming: upcoming.length,
    shown: shown.map((gameNight, index) => {
      const result = members[index];
      return { gameNight, members: result.status === "fulfilled" ? result.value : null };
    }),
  };
}

export function useUpcomingGameNights() {
  return useUserResource(loadUpcomingGameNights);
}
