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
