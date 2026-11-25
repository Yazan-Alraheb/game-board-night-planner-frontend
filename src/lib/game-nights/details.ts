/**
 * Pure helpers for the Game Night Details page (/game-nights/[id]).
 *
 * Checked against the FastAPI source (app/api/v1/game_nights.py):
 * - GET /{id}, /{id}/members and /{id}/games return 404 for anyone who is neither the host
 *   nor on the members list (declined members can still see the night).
 * - PUT and DELETE /{id}, POST /{id}/members and POST/DELETE /{id}/games are host-only (403).
 * - DELETE /{id}/members/{user_id}: non-hosts may only remove themselves; the host can't leave.
 *
 * The permissions here only decide which controls to show. The backend enforces them.
 */

import axios from "axios";
import type { ApiErrorInfo } from "@/api/errors";
import { isPastGameNight } from "@/lib/find-game/game-nights";
import { getAvailableAnswers, getMyStatus } from "@/lib/game-nights/overview";
import type {
  GameNightAvailableGame,
  GameNightMember,
  GameNightResponse,
  GameNightUpdate,
  RsvpUpdate,
} from "@/types/game-night";

/* ------------------------------------------------------------------ route */

/** The `[id]` route segment as a positive integer, or null for anything else ("abc", "1.5", "-3"). */
export function parseGameNightId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

/* ------------------------------------------------------------ roles */

/** The current user's relationship to the night. "unknown" while members are missing. */
export type DetailsRole = "host" | "accepted" | "pending" | "declined" | "unknown";

export function getDetailsRole(
  gameNight: GameNightResponse,
  userId: number,
  members: readonly GameNightMember[] | null,
): DetailsRole {
  const status = getMyStatus(gameNight, userId, members);
  switch (status) {
    case "hosting":
      return "host";
    case "going":
      return "accepted";
    case "invited":
      return "pending";
    case "declined":
      return "declined";
    default:
      return "unknown";
  }
}

export interface DetailsPermissions {
  role: DetailsRole;
  isHost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Invite more friends. Only before the night starts. */
  canInvite: boolean;
  /** Select or unselect games. */
  canManageGames: boolean;
  /** Remove yourself from the night. Never the host (the backend refuses). */
  canLeave: boolean;
  /** RSVP answers to offer, as on the overview card. */
  rsvpAnswers: RsvpUpdate["status"][];
}

export function getDetailsPermissions(
  gameNight: GameNightResponse,
  userId: number,
  members: readonly GameNightMember[] | null,
  now: number,
): DetailsPermissions {
  const isHost = gameNight.host_id === userId;
  const role = getDetailsRole(gameNight, userId, members);
  const isGuestMember = role === "accepted" || role === "pending" || role === "declined";

  return {
    role,
    isHost,
    canEdit: isHost,
    canDelete: isHost,
    canInvite: isHost && !isPastGameNight(gameNight, now),
    canManageGames: isHost,
    canLeave: !isHost && isGuestMember,
    rsvpAnswers: isHost ? [] : getAvailableAnswers(gameNight, userId, members, now),
  };
}

/* ------------------------------------------------------------ attendees */

export interface AttendeeGroups {
  /** null if the backend didn't list the host (it normally stores them as accepted). */
  host: GameNightMember | null;
  /** Accepted guests, without the host. */
  accepted: GameNightMember[];
  pending: GameNightMember[];
  declined: GameNightMember[];
}

const byName = (a: GameNightMember, b: GameNightMember) =>
  a.user.name.localeCompare(b.user.name) || a.user.id - b.user.id;

export function groupAttendees(members: readonly GameNightMember[], hostId: number): AttendeeGroups {
  const groups: AttendeeGroups = { host: null, accepted: [], pending: [], declined: [] };

  for (const member of members) {
    if (member.user.id === hostId) groups.host = member;
    else if (member.status === "accepted") groups.accepted.push(member);
    else if (member.status === "pending") groups.pending.push(member);
    else if (member.status === "declined") groups.declined.push(member);
  }

  groups.accepted.sort(byName);
  groups.pending.sort(byName);
  groups.declined.sort(byName);
  return groups;
}

/** Ids of everyone already on the night (any status), so they aren't offered as invitees. */
export function memberIds(members: readonly GameNightMember[]): Set<number> {
  return new Set(members.map((member) => member.user.id));
}

/* ------------------------------------------------------------ games */

export interface SplitGames {
  /** Games chosen for the event. */
  selected: GameNightAvailableGame[];
  /** Other games accepted attendees own: candidates, not part of the plan. */
  available: GameNightAvailableGame[];
}

const byGameName = (a: GameNightAvailableGame, b: GameNightAvailableGame) =>
  a.game.name.localeCompare(b.game.name) || a.game.id - b.game.id;

export function splitGames(entries: readonly GameNightAvailableGame[]): SplitGames {
  return {
    selected: entries.filter((entry) => entry.selected).sort(byGameName),
    available: entries.filter((entry) => !entry.selected).sort(byGameName),
  };
}

/** The entries after the backend confirmed a game was (un)selected. */
export function setGameSelected(
  entries: readonly GameNightAvailableGame[],
  gameId: number,
  selected: boolean,
): GameNightAvailableGame[] {
  return entries.map((entry) => (entry.game.id === gameId ? { ...entry, selected } : entry));
}

/* ------------------------------------------------------------ edit form */

export interface EditFormValues {
  name: string;
  /** `<input type="datetime-local">` value in the viewer's time zone, e.g. "2026-12-05T19:30". */
  startsAt: string;
  location: string;
  notes: string;
}

export type EditField = keyof EditFormValues;
export type EditFormErrors = Partial<Record<EditField, string>>;

const pad = (value: number) => String(value).padStart(2, "0");

/** ISO date-time → datetime-local value in the viewer's time zone (minute precision). */
export function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;

/**
 * datetime-local value → Date in the viewer's time zone. Null for malformed values,
 * impossible dates (Feb 30) and local times skipped by a daylight-saving change.
 */
export function parseDateTimeLocalValue(value: string): Date | null {
  const match = DATETIME_LOCAL.exec(value.trim());
  if (!match) return null;

  // Seconds are optional; a missing group is undefined, which must become 0 (not NaN).
  const [year, month, day, hours, minutes, seconds] = match.slice(1, 7).map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes;
  return roundTrips ? date : null;
}

export function toEditFormValues(gameNight: GameNightResponse): EditFormValues {
  return {
    name: gameNight.name,
    startsAt: toDateTimeLocalValue(gameNight.starts_at),
    location: gameNight.location,
    notes: gameNight.notes ?? "",
  };
}

/** True when the date field still shows the saved start time (seconds aside). */
function startTimeUnchanged(values: EditFormValues, original: GameNightResponse): boolean {
  return values.startsAt === toDateTimeLocalValue(original.starts_at);
}

/**
 * Client-side checks matching GameNightUpdate (name and location need at least one
 * character; starts_at must be a real date-time). Whitespace-only text is also rejected:
 * the backend would accept it, but it would show as a blank name.
 * Moving a night into the past is refused; keeping an already-past time is allowed.
 */
export function validateEditForm(
  values: EditFormValues,
  original: GameNightResponse,
  now: number,
): EditFormErrors {
  const errors: EditFormErrors = {};

  if (!values.name.trim()) errors.name = "Enter a name for the game night.";
  if (!values.location.trim()) errors.location = "Enter a location.";

  if (!values.startsAt.trim()) {
    errors.startsAt = "Choose a date and time.";
  } else {
    const date = parseDateTimeLocalValue(values.startsAt);
    if (!date) errors.startsAt = "Enter a valid date and time.";
    else if (!startTimeUnchanged(values, original) && date.getTime() < now) {
      errors.startsAt = "Choose a date and time in the future.";
    }
  }

  return errors;
}

export const hasErrors = (errors: EditFormErrors) => Object.keys(errors).length > 0;

/**
 * The PUT body. Contains exactly the four editable fields, so members and selected games
 * can't be touched. Untouched fields are sent exactly as the server returned them (the
 * start time keeps its seconds; text keeps its original spacing). Edited text is trimmed and
 * empty notes become null. The start time is sent as UTC ISO 8601 with a "Z" offset.
 * Call only after validateEditForm returned no errors.
 */
export function buildUpdatePayload(
  values: EditFormValues,
  original: GameNightResponse,
): GameNightUpdate {
  let startsAt = original.starts_at;
  if (!startTimeUnchanged(values, original)) {
    const date = parseDateTimeLocalValue(values.startsAt);
    if (!date) throw new Error("buildUpdatePayload called with an invalid start time");
    startsAt = date.toISOString();
  }

  const originalNotes = original.notes ?? "";
  const notes = values.notes === originalNotes ? original.notes : values.notes.trim() || null;

  return {
    name: values.name === original.name ? original.name : values.name.trim(),
    starts_at: startsAt,
    location: values.location === original.location ? original.location : values.location.trim(),
    notes,
  };
}

/** False when saving would send the night's current values back unchanged. */
export function hasEditChanges(values: EditFormValues, original: GameNightResponse): boolean {
  const payload = buildUpdatePayload(values, original);
  return (
    payload.name !== original.name ||
    payload.location !== original.location ||
    payload.notes !== original.notes ||
    new Date(payload.starts_at).getTime() !== new Date(original.starts_at).getTime()
  );
}

const SERVER_FIELDS: Record<string, EditField> = {
  name: "name",
  starts_at: "startsAt",
  location: "location",
  notes: "notes",
};

/**
 * Field messages from a FastAPI 422 body: `{"detail": [{"loc": ["body", "name"], "msg": "..."}]}`.
 * Reads only `response.data.detail`; nothing else from the Axios error is touched.
 */
export function getServerFieldErrors(error: unknown): EditFormErrors {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) return {};

  const data: unknown = error.response.data;
  if (!data || typeof data !== "object" || !("detail" in data) || !Array.isArray(data.detail)) {
    return {};
  }

  const errors: EditFormErrors = {};
  for (const item of data.detail as unknown[]) {
    if (!item || typeof item !== "object" || !("loc" in item) || !Array.isArray(item.loc)) continue;
    const field = SERVER_FIELDS[String(item.loc[item.loc.length - 1])];
    if (!field || errors[field]) continue;
    const message = "msg" in item && typeof item.msg === "string" ? item.msg : "This value is invalid.";
    errors[field] = field === "startsAt" ? `Invalid date and time: ${message}` : message;
  }
  return errors;
}

/* ------------------------------------------------------------ errors */

export interface LoadErrorDescription {
  title: string;
  message: string;
  /** Not found / no access can't be fixed by retrying. */
  retryable: boolean;
}

/** For a failed GET /api/game-nights/{id}. The backend uses 404 for "no access" too. */
export function describeLoadError(error: ApiErrorInfo): LoadErrorDescription {
  switch (error.kind) {
    case "not_found":
    case "forbidden":
      return {
        title: "Game night not found",
        message:
          "This game night doesn't exist, was deleted, or you aren't invited to it.",
        retryable: false,
      };
    case "unauthorized":
      return {
        title: "Session expired",
        message: "Your session has expired. Please log in again.",
        retryable: false,
      };
    case "network":
      return {
        title: "Couldn't reach the server",
        message: "Check your connection and try again.",
        retryable: true,
      };
    default:
      return {
        title: "Something went wrong",
        message: "We couldn't load this game night. Please try again.",
        retryable: true,
      };
  }
}

/**
 * What the page should do after a failed mutation:
 * - "gone": the night no longer exists or is no longer visible; show the not-found state
 * - "reload": the user's role may have changed; re-fetch the event and members
 * - "none": stay put; the user can retry
 */
export type MutationOutcome = "gone" | "reload" | "none";

export interface MutationErrorDescription {
  message: string;
  outcome: MutationOutcome;
}

function commonMutationError(error: ApiErrorInfo): MutationErrorDescription | null {
  switch (error.kind) {
    case "unauthorized":
      return { message: "Your session has expired. Please log in again.", outcome: "none" };
    case "canceled":
      return { message: "", outcome: "none" };
    default:
      return null;
  }
}

/** For a failed PUT /api/game-nights/{id}. The form keeps the user's edits in every case. */
export function describeUpdateError(error: ApiErrorInfo): MutationErrorDescription {
  const common = commonMutationError(error);
  if (common) return common;

  switch (error.kind) {
    case "forbidden":
      return { message: "Only the host can edit this game night.", outcome: "reload" };
    case "not_found":
      return {
        message: "This game night no longer exists. It may have been deleted.",
        outcome: "gone",
      };
    case "validation":
    case "bad_request":
      return { message: "Some details weren't accepted. Please check the highlighted fields.", outcome: "none" };
    case "network":
      return {
        message:
          "Couldn't reach the server. Your edits are still here; please try again. If the problem continues, reload the page to check whether they were saved.",
        outcome: "none",
      };
    default:
      return { message: "Something went wrong and your changes weren't saved. Please try again.", outcome: "none" };
  }
}

/** For a failed DELETE /api/game-nights/{id}. "gone" means it was already deleted. */
export function describeDeleteError(error: ApiErrorInfo): MutationErrorDescription {
  const common = commonMutationError(error);
  if (common) return common;

  switch (error.kind) {
    case "forbidden":
      return { message: "Only the host can delete this game night.", outcome: "reload" };
    case "not_found":
      return { message: "This game night had already been deleted.", outcome: "gone" };
    case "network":
      return {
        message: "Couldn't reach the server, so the game night may not have been deleted. Please try again.",
        outcome: "none",
      };
    default:
      return { message: "Something went wrong and the game night wasn't deleted. Please try again.", outcome: "none" };
  }
}

/** For a failed DELETE /api/game-nights/{id}/members/{own id}. */
export function describeLeaveError(error: ApiErrorInfo): MutationErrorDescription {
  const common = commonMutationError(error);
  if (common) return common;

  switch (error.kind) {
    case "forbidden":
      // "The host cannot leave the game night" (e.g. host_id changed) or a stale role.
      return { message: "You can't leave this game night.", outcome: "reload" };
    case "not_found":
      return {
        message: "You're no longer on this game night, or it was deleted.",
        outcome: "gone",
      };
    case "network":
      return { message: "Couldn't reach the server. Please try again.", outcome: "none" };
    default:
      return { message: "Something went wrong and you weren't removed. Please try again.", outcome: "none" };
  }
}

/** For a failed POST /api/game-nights/{id}/members. "reload" also refreshes the members list. */
export function describeInviteError(error: ApiErrorInfo, friendName: string): MutationErrorDescription {
  const common = commonMutationError(error);
  if (common) return common;

  switch (error.kind) {
    case "conflict":
      return { message: `${friendName} is already on this game night.`, outcome: "reload" };
    case "forbidden":
      return {
        message: `Couldn't invite ${friendName}. You can only invite accepted friends to a night you host.`,
        outcome: "reload",
      };
    case "not_found":
      return { message: "This game night or user no longer exists.", outcome: "reload" };
    case "network":
      return { message: "Couldn't reach the server. Please try again.", outcome: "none" };
    default:
      return { message: `Something went wrong and ${friendName} wasn't invited. Please try again.`, outcome: "none" };
  }
}

/** For a failed POST or DELETE /api/game-nights/{id}/games. "reload" re-fetches the games. */
export function describeGameActionError(
  error: ApiErrorInfo,
  action: "add" | "remove",
  gameName: string,
): MutationErrorDescription {
  const common = commonMutationError(error);
  if (common) return common;

  switch (error.kind) {
    case "conflict":
      return { message: `${gameName} is already selected.`, outcome: "reload" };
    case "forbidden":
      return action === "add"
        ? {
            message: `${gameName} can't be selected: no accepted attendee owns it anymore.`,
            outcome: "reload",
          }
        : { message: "Only the host can change the selected games.", outcome: "reload" };
    case "not_found":
      return action === "remove"
        ? { message: `${gameName} was already removed.`, outcome: "reload" }
        : { message: "This game or game night no longer exists.", outcome: "reload" };
    case "network":
      return { message: "Couldn't reach the server. Please try again.", outcome: "none" };
    default:
      return {
        message: `Something went wrong and ${gameName} wasn't ${action === "add" ? "added" : "removed"}. Please try again.`,
        outcome: "none",
      };
  }
}
