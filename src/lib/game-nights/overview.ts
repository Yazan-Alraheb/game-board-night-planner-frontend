/**
 * Pure helpers for the My Game Nights page (/game-nights).
 *
 * GET /api/game-nights returns one flat list: nights the user hosts plus every night they
 * have a membership on, including declined ones. It has no RSVP status, so the user's own
 * status comes from GET /api/game-nights/{id}/members. Nothing here guesses a status.
 */

import type { ApiErrorInfo } from "@/api/errors";
import { isPastGameNight } from "@/lib/find-game/game-nights";
import {
  summarizeAttendees as summarizeHomeAttendees,
  type AttendeeSummary,
  type GameNightRole,
} from "@/lib/home/upcoming-game-nights";
import type { PublicUser } from "@/types/friend";
import type {
  GameNightMember,
  GameNightMemberStatus,
  GameNightResponse,
  RsvpUpdate,
} from "@/types/game-night";

/** The current user's relationship to a night, as labelled on its card (same as the homepage's). */
export type MyGameNightStatus = GameNightRole;

export type MembersState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; members: GameNightMember[] };

export interface OverviewEntry {
  gameNight: GameNightResponse;
  members: MembersState;
}

export type OverviewTab = "upcoming" | "invitations" | "past" | "declined";

export type GroupedGameNights = Record<OverviewTab, OverviewEntry[]>;

export function loadedMembers(state: MembersState | undefined): GameNightMember[] | null {
  return state?.status === "success" ? state.members : null;
}

/**
 * Hosting comes from host_id. Otherwise the user's own membership decides.
 * Returns null when it can't be known: members not loaded (or failed), or the user
 * isn't in the list (e.g. removed since the list loaded).
 *
 * Unlike the homepage's getGameNightRole, this never falls back to "invited": the
 * overview sorts nights into tabs by status, so an unknown status must stay unknown.
 */
export function getMyStatus(
  gameNight: GameNightResponse,
  userId: number,
  members: readonly GameNightMember[] | null,
): MyGameNightStatus | null {
  if (gameNight.host_id === userId) return "hosting";
  if (members === null) return null;

  const mine = members.find((member) => member.user.id === userId);
  if (!mine) return null;

  const byStatus: Record<GameNightMemberStatus, MyGameNightStatus> = {
    accepted: "going",
    pending: "invited",
    declined: "declined",
  };
  return byStatus[mine.status] ?? null;
}

function startTime(entry: OverviewEntry): number {
  return new Date(entry.gameNight.starts_at).getTime();
}

const soonestFirst = (a: OverviewEntry, b: OverviewEntry) => startTime(a) - startTime(b);
const latestFirst = (a: OverviewEntry, b: OverviewEntry) => startTime(b) - startTime(a);

/**
 * Splits nights into the page's tabs. Each night appears in exactly one tab:
 * - declined: every night the user declined (future soonest first, then past latest first)
 * - invitations: future nights with an unanswered invitation, soonest first
 * - upcoming: future nights the user hosts or accepted, soonest first. Future nights whose
 *   status couldn't be loaded also go here (flagged on the card), so they don't vanish.
 * - past: nights that have started, latest first, except declined ones
 */
export function groupGameNights(
  entries: readonly OverviewEntry[],
  userId: number,
  now: number,
): GroupedGameNights {
  const groups: GroupedGameNights = { upcoming: [], invitations: [], past: [], declined: [] };

  for (const entry of entries) {
    const status = getMyStatus(entry.gameNight, userId, loadedMembers(entry.members));
    const past = isPastGameNight(entry.gameNight, now);

    if (status === "declined") groups.declined.push(entry);
    else if (past) groups.past.push(entry);
    else if (status === "invited") groups.invitations.push(entry);
    else groups.upcoming.push(entry);
  }

  groups.upcoming.sort(soonestFirst);
  groups.invitations.sort(soonestFirst);
  groups.past.sort(latestFirst);
  groups.declined = [
    ...groups.declined.filter((entry) => !isPastGameNight(entry.gameNight, now)).sort(soonestFirst),
    ...groups.declined.filter((entry) => isPastGameNight(entry.gameNight, now)).sort(latestFirst),
  ];

  return groups;
}

/**
 * The RSVP answers the card offers, for nights that haven't started (never for the host):
 * - an unanswered invitation: Accept or Decline
 * - a declined invitation: Accept, for when the user changes their mind
 * - an accepted invitation: Decline, for when the user can't make it anymore
 * The backend still enforces its own rules (it allows any change between accepted and
 * declined, except that the host can't decline).
 */
export function getAvailableAnswers(
  gameNight: GameNightResponse,
  userId: number,
  members: readonly GameNightMember[] | null,
  now: number,
): RsvpUpdate["status"][] {
  if (isPastGameNight(gameNight, now)) return [];

  const status = getMyStatus(gameNight, userId, members);
  if (status === "invited") return ["accepted", "declined"];
  if (status === "declined") return ["accepted"];
  if (status === "going") return ["declined"];
  return [];
}

/** True for the user's own unanswered invitation to a night that hasn't started. */
export function canRespondToInvitation(
  gameNight: GameNightResponse,
  userId: number,
  members: readonly GameNightMember[] | null,
  now: number,
): boolean {
  return getMyStatus(gameNight, userId, members) === "invited" && !isPastGameNight(gameNight, now);
}

/** The homepage's attendee summary, with the host moved to the front of `going`. */
export function summarizeAttendees(
  members: readonly GameNightMember[],
  hostId: number,
): AttendeeSummary {
  const summary = summarizeHomeAttendees(members);
  return {
    ...summary,
    going: summary.going.sort((a, b) => Number(b.id === hostId) - Number(a.id === hostId)),
  };
}

/** The host's public profile, when the backend included them in the members list. */
export function findHost(
  members: readonly GameNightMember[],
  hostId: number,
): PublicUser | null {
  return members.find((member) => member.user.id === hostId)?.user ?? null;
}

/**
 * The members list after the backend confirmed the user's new RSVP status.
 * Returns the same array when the user isn't in it.
 */
export function applyRsvpStatus(
  members: GameNightMember[],
  userId: number,
  status: GameNightMemberStatus,
): GameNightMember[] {
  if (!members.some((member) => member.user.id === userId)) return members;
  return members.map((member) => (member.user.id === userId ? { ...member, status } : member));
}

/**
 * What to reload after a failed RSVP so the card shows the backend's real state:
 * "list" when the night may be gone, "members" when the status may have changed.
 */
export type RsvpRefresh = "list" | "members" | "none";

export interface RsvpErrorDescription {
  message: string;
  refresh: RsvpRefresh;
}

/** User-facing message for a failed PUT /api/game-nights/{id}/rsvp. */
export function describeRsvpError(
  error: ApiErrorInfo,
  answer: RsvpUpdate["status"],
): RsvpErrorDescription {
  const verb = answer === "accepted" ? "accept" : "decline";

  switch (error.kind) {
    case "unauthorized":
      return { message: "Your session has expired. Please log in again.", refresh: "none" };
    case "forbidden":
      // e.g. "You are not invited to this game night": the invitation was withdrawn.
      return {
        message: "You can't respond to this invitation anymore. We've refreshed your game nights.",
        refresh: "list",
      };
    case "not_found":
      return {
        message: "This game night is no longer available. It may have been cancelled.",
        refresh: "list",
      };
    case "conflict":
      return {
        message: "This invitation was already updated. We've refreshed its status.",
        refresh: "members",
      };
    case "bad_request":
    case "validation":
      return {
        message: `We couldn't ${verb} this invitation. Its status has been refreshed; please try again.`,
        refresh: "members",
      };
    case "network":
      // A timeout may still have reached the server, so re-check the status quietly.
      return {
        message: "Couldn't reach the server. Check your connection and try again.",
        refresh: "members",
      };
    case "canceled":
      return { message: "", refresh: "none" };
    default:
      return {
        message: `Something went wrong and we couldn't ${verb} this invitation. Please try again.`,
        refresh: "members",
      };
  }
}
