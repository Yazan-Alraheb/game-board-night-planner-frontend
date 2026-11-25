"use client";

import { getGameNightMembers, getGameNights } from "@/api/game-nights";
import { useUserResource } from "@/hooks/useUserResource";
import {
  selectUpcomingGameNights,
  selectVisibleGameNights,
  type VisibleGameNights,
} from "@/lib/home/upcoming-game-nights";

/** Matches the two-card homepage layout. */
export const HOMEPAGE_GAME_NIGHT_LIMIT = 2;

/**
 * One list request, then members requests for the soonest nights until
 * HOMEPAGE_GAME_NIGHT_LIMIT + 1 non-declined nights are found (see selectVisibleGameNights).
 */
async function loadUpcomingGameNights(userId: number, signal: AbortSignal): Promise<VisibleGameNights> {
  const upcoming = selectUpcomingGameNights(await getGameNights(signal), Date.now());

  return selectVisibleGameNights(
    upcoming,
    userId,
    HOMEPAGE_GAME_NIGHT_LIMIT,
    (gameNightId) => getGameNightMembers(gameNightId, signal),
    signal,
  );
}

export function useUpcomingGameNights() {
  return useUserResource(loadUpcomingGameNights);
}
