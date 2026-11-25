import { isPastGameNight } from "@/lib/find-game/game-nights";
import type { PublicUser } from "@/types/friend";
import type { GameNightMember, GameNightResponse } from "@/types/game-night";

/** The current user's relationship to a game night, as shown on its card. */
export type GameNightRole = "hosting" | "going" | "invited" | "declined";

export interface AttendeeSummary {
  /** Accepted members (the backend stores the host as accepted). */
  going: PublicUser[];
  /** Invitations that haven't been answered yet. */
  pendingCount: number;
}

/** Game nights that haven't started yet, soonest first. Does not mutate the input. */
export function selectUpcomingGameNights(
  gameNights: readonly GameNightResponse[],
  now: number,
): GameNightResponse[] {
  return gameNights
    .filter((gameNight) => !isPastGameNight(gameNight, now))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

export interface UpcomingGameNight {
  gameNight: GameNightResponse;
  /** null when the members request failed; the card still shows the event itself. */
  members: GameNightMember[] | null;
}

export interface VisibleGameNights {
  shown: UpcomingGameNight[];
  /** True when at least one more upcoming, not-declined night exists beyond `shown`. */
  hasMore: boolean;
}

/** True when the user's own membership on the night is "declined". */
export function hasDeclined(members: readonly GameNightMember[], userId: number): boolean {
  return members.some((member) => member.user.id === userId && member.status === "declined");
}

/**
 * Picks the first `limit` upcoming nights the user hasn't declined, plus whether more exist.
 *
 * Only the members list says whether the user declined (the backend has no batch endpoint),
 * so members are fetched in small batches, soonest first, and fetching stops as soon as
 * `limit + 1` nights are kept. Usually that is a single batch of `limit + 1` requests.
 * A night whose members request fails is kept (with members: null) rather than hidden,
 * because we can't tell whether it was declined.
 *
 * @param upcoming nights already filtered to upcoming and sorted (see selectUpcomingGameNights)
 */
export async function selectVisibleGameNights(
  upcoming: readonly GameNightResponse[],
  userId: number,
  limit: number,
  fetchMembers: (gameNightId: number) => Promise<GameNightMember[]>,
  signal?: AbortSignal,
): Promise<VisibleGameNights> {
  const kept: UpcomingGameNight[] = [];
  let next = 0;

  while (kept.length <= limit && next < upcoming.length) {
    const batch = upcoming.slice(next, next + (limit + 1 - kept.length));
    next += batch.length;

    const results = await Promise.allSettled(batch.map((gameNight) => fetchMembers(gameNight.id)));
    signal?.throwIfAborted();

    batch.forEach((gameNight, index) => {
      const result = results[index];
      const members = result.status === "fulfilled" ? result.value : null;
      if (members !== null && hasDeclined(members, userId)) return;
      kept.push({ gameNight, members });
    });
  }

  return { shown: kept.slice(0, limit), hasMore: kept.length > limit };
}

/**
 * Hosting comes from host_id. For other nights the user's own RSVP decides the label;
 * when the members couldn't be loaded we only know they were invited.
 */
export function getGameNightRole(
  gameNight: GameNightResponse,
  userId: number,
  members: readonly GameNightMember[] | null,
): GameNightRole {
  if (gameNight.host_id === userId) return "hosting";

  const myStatus = members?.find((member) => member.user.id === userId)?.status;
  if (myStatus === "accepted") return "going";
  if (myStatus === "declined") return "declined";
  return "invited";
}

export function summarizeAttendees(members: readonly GameNightMember[]): AttendeeSummary {
  return {
    going: members.filter((member) => member.status === "accepted").map((member) => member.user),
    pendingCount: members.filter((member) => member.status === "pending").length,
  };
}
