/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AxiosError, AxiosHeaders } from "axios";
import type { ApiErrorInfo, ApiErrorKind } from "@/api/errors";
import {
  buildUpdatePayload,
  describeDeleteError,
  describeGameActionError,
  describeInviteError,
  describeLeaveError,
  describeLoadError,
  describeUpdateError,
  getDetailsPermissions,
  getDetailsRole,
  getServerFieldErrors,
  groupAttendees,
  hasEditChanges,
  hasErrors,
  memberIds,
  parseDateTimeLocalValue,
  parseGameNightId,
  setGameSelected,
  splitGames,
  toDateTimeLocalValue,
  toEditFormValues,
  validateEditForm,
  type EditFormValues,
} from "@/lib/game-nights/details";
import type { PublicUser } from "@/types/friend";
import type { Game } from "@/types/game";
import type {
  GameNightAvailableGame,
  GameNightMember,
  GameNightMemberStatus,
  GameNightResponse,
} from "@/types/game-night";

// Fixed time zone with daylight saving, so local-time conversions are predictable.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const HOST = 1;
const GUEST = 2;
const NOW = new Date("2026-11-25T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

const user = (id: number, name = `User ${id}`): PublicUser => ({
  id,
  name,
  username: `user${id}`,
  bio: null,
  avatar_url: null,
});
const member = (id: number, status: GameNightMemberStatus, name?: string): GameNightMember => ({
  user: user(id, name),
  status,
});

function night(overrides: Partial<GameNightResponse> = {}): GameNightResponse {
  return {
    id: 7,
    host_id: HOST,
    name: "Strategy Night",
    starts_at: new Date(NOW + 48 * HOUR).toISOString(),
    location: "42 Maple Street",
    notes: "Bring snacks",
    created_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

function game(id: number, name: string): Game {
  return {
    id,
    name,
    description: null,
    minimum_players: 2,
    maximum_players: 4,
    playtime: 60,
    difficulty: "Medium",
    categories: [],
    image_url: null,
    rating: null,
    review_count: null,
    instructions: null,
  };
}

const entry = (id: number, name: string, selected: boolean): GameNightAvailableGame => ({
  game: game(id, name),
  owners: [user(HOST)],
  selected,
});

const info = (kind: ApiErrorKind): ApiErrorInfo => ({ kind, status: null, detail: null });

const MEMBERS = [member(HOST, "accepted"), member(GUEST, "accepted"), member(3, "pending"), member(4, "declined")];

describe("parseGameNightId", () => {
  test("accepts positive integers only", () => {
    expect(parseGameNightId("42")).toBe(42);
    for (const bad of ["0", "-1", "1.5", "abc", "1e3", " 4", "04", "", "99999999999999999999"]) {
      expect(parseGameNightId(bad)).toBeNull();
    }
    expect(parseGameNightId(undefined)).toBeNull();
    expect(parseGameNightId(["1", "2"])).toBeNull();
  });
});

describe("roles and permissions", () => {
  test("the host can edit, delete, invite and manage games, but not leave or RSVP", () => {
    const permissions = getDetailsPermissions(night(), HOST, MEMBERS, NOW);
    expect(permissions).toMatchObject({
      role: "host",
      isHost: true,
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageGames: true,
      canLeave: false,
      rsvpAnswers: [],
    });
  });

  test("host permissions come from host_id, even before members load", () => {
    const permissions = getDetailsPermissions(night(), HOST, null, NOW);
    expect(permissions.canEdit).toBe(true);
    expect(permissions.canDelete).toBe(true);
  });

  test("an accepted guest can leave and decline, but has no host actions", () => {
    const permissions = getDetailsPermissions(night(), GUEST, MEMBERS, NOW);
    expect(permissions).toMatchObject({
      role: "accepted",
      isHost: false,
      canEdit: false,
      canDelete: false,
      canInvite: false,
      canManageGames: false,
      canLeave: true,
      rsvpAnswers: ["declined"],
    });
  });

  test("a pending invitee can accept or decline", () => {
    const permissions = getDetailsPermissions(night(), 3, MEMBERS, NOW);
    expect(permissions.role).toBe("pending");
    expect(permissions.rsvpAnswers).toEqual(["accepted", "declined"]);
    expect(permissions.canEdit).toBe(false);
  });

  test("a declined invitee can accept again", () => {
    const permissions = getDetailsPermissions(night(), 4, MEMBERS, NOW);
    expect(permissions.role).toBe("declined");
    expect(permissions.rsvpAnswers).toEqual(["accepted"]);
    expect(permissions.canDelete).toBe(false);
  });

  test("unknown membership offers nothing (no leave, no RSVP)", () => {
    expect(getDetailsPermissions(night(), GUEST, null, NOW)).toMatchObject({
      role: "unknown",
      canLeave: false,
      rsvpAnswers: [],
      canEdit: false,
    });
    // A user missing from the list (e.g. just removed) is also unknown.
    expect(getDetailsRole(night(), 99, MEMBERS)).toBe("unknown");
  });

  test("after the night starts: no RSVP changes and no new invitations, but editing stays", () => {
    const started = night({ starts_at: new Date(NOW - HOUR).toISOString() });
    expect(getDetailsPermissions(started, GUEST, MEMBERS, NOW).rsvpAnswers).toEqual([]);
    const host = getDetailsPermissions(started, HOST, MEMBERS, NOW);
    expect(host.canInvite).toBe(false);
    expect(host.canEdit).toBe(true);
  });

  test("a badge-like 'accepted' status for the host user doesn't make a non-host the host", () => {
    // host_id decides; a members entry alone never grants host actions.
    const permissions = getDetailsPermissions(night({ host_id: 50 }), HOST, MEMBERS, NOW);
    expect(permissions.isHost).toBe(false);
    expect(permissions.canEdit).toBe(false);
    expect(permissions.canDelete).toBe(false);
  });
});

describe("groupAttendees", () => {
  test("separates the host and groups guests by status, sorted by name", () => {
    const groups = groupAttendees(
      [
        member(5, "accepted", "Zoe"),
        member(HOST, "accepted", "Host"),
        member(6, "accepted", "Ana"),
        member(3, "pending", "Pat"),
        member(4, "declined", "Dee"),
      ],
      HOST,
    );
    expect(groups.host?.user.id).toBe(HOST);
    expect(groups.accepted.map((m) => m.user.name)).toEqual(["Ana", "Zoe"]);
    expect(groups.pending.map((m) => m.user.id)).toEqual([3]);
    expect(groups.declined.map((m) => m.user.id)).toEqual([4]);
  });

  test("never invents a host when the backend didn't list one", () => {
    expect(groupAttendees([member(GUEST, "accepted")], HOST).host).toBeNull();
  });

  test("memberIds covers every status, so nobody already on the night is re-invited", () => {
    expect([...memberIds(MEMBERS)].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("selected versus owned games", () => {
  const games = [entry(1, "Wingspan", false), entry(2, "Catan", true), entry(3, "Azul", true)];

  test("splitGames keeps selected games apart from other owned games", () => {
    const { selected, available } = splitGames(games);
    expect(selected.map((g) => g.game.name)).toEqual(["Azul", "Catan"]);
    expect(available.map((g) => g.game.name)).toEqual(["Wingspan"]);
  });

  test("an empty response gives empty lists", () => {
    expect(splitGames([])).toEqual({ selected: [], available: [] });
  });

  test("setGameSelected changes only the given game and doesn't mutate the input", () => {
    const next = setGameSelected(games, 1, true);
    expect(next.find((g) => g.game.id === 1)?.selected).toBe(true);
    expect(next.find((g) => g.game.id === 2)?.selected).toBe(true);
    expect(games[0].selected).toBe(false);
  });
});

describe("date-time conversion", () => {
  test("datetime-local values are read in the viewer's time zone and sent as UTC", () => {
    // 19:30 in Los Angeles (PST, UTC-8) is 03:30 UTC the next day.
    expect(parseDateTimeLocalValue("2026-12-05T19:30")?.toISOString()).toBe("2026-12-06T03:30:00.000Z");
    // Summer time (PDT, UTC-7).
    expect(parseDateTimeLocalValue("2026-07-01T18:00")?.toISOString()).toBe("2026-07-02T01:00:00.000Z");
    // Optional seconds.
    expect(parseDateTimeLocalValue("2026-12-05T19:30:15")?.toISOString()).toBe("2026-12-06T03:30:15.000Z");
  });

  test("UTC from the server is shown in local time", () => {
    expect(toDateTimeLocalValue("2026-12-06T03:30:00Z")).toBe("2026-12-05T19:30");
    expect(toDateTimeLocalValue("2026-12-06T03:30:00+00:00")).toBe("2026-12-05T19:30");
    expect(toDateTimeLocalValue("not a date")).toBe("");
  });

  test("round-trips", () => {
    const value = "2027-01-08T07:05";
    expect(toDateTimeLocalValue(parseDateTimeLocalValue(value)!.toISOString())).toBe(value);
  });

  test("rejects malformed, impossible and skipped (DST) times", () => {
    for (const bad of ["", "2026-12-05", "2026-12-05 19:30", "12/05/2026 7:30 PM", "2026-02-30T10:00", "2026-13-01T10:00", "2026-12-05T25:00"]) {
      expect(parseDateTimeLocalValue(bad)).toBeNull();
    }
    // Clocks jump from 02:00 to 03:00 in Los Angeles on 2027-03-14.
    expect(parseDateTimeLocalValue("2027-03-14T02:30")).toBeNull();
  });
});

describe("edit form validation", () => {
  const original = night();
  const valid = (overrides: Partial<EditFormValues> = {}): EditFormValues => ({
    ...toEditFormValues(original),
    ...overrides,
  });

  test("initial values come from the event", () => {
    expect(toEditFormValues(night({ notes: null }))).toEqual({
      name: "Strategy Night",
      startsAt: toDateTimeLocalValue(original.starts_at),
      location: "42 Maple Street",
      notes: "",
    });
  });

  test("unchanged values are valid", () => {
    expect(hasErrors(validateEditForm(valid(), original, NOW))).toBe(false);
  });

  test("requires a name, location and date; blank-only text counts as empty", () => {
    const errors = validateEditForm(valid({ name: "   ", location: "", startsAt: "" }), original, NOW);
    expect(Object.keys(errors).sort()).toEqual(["location", "name", "startsAt"]);
  });

  test("rejects invalid dates", () => {
    expect(validateEditForm(valid({ startsAt: "2026-02-30T10:00" }), original, NOW).startsAt).toBe(
      "Enter a valid date and time.",
    );
  });

  test("refuses moving the night into the past", () => {
    expect(validateEditForm(valid({ startsAt: "2026-11-01T10:00" }), original, NOW).startsAt).toBe(
      "Choose a date and time in the future.",
    );
  });

  test("an already-past night can still be edited without changing its time", () => {
    const started = night({ starts_at: new Date(NOW - 5 * HOUR).toISOString() });
    const values = { ...toEditFormValues(started), notes: "Thanks for coming!" };
    expect(hasErrors(validateEditForm(values, started, NOW))).toBe(false);
  });

  test("notes are optional", () => {
    expect(hasErrors(validateEditForm(valid({ notes: "" }), original, NOW))).toBe(false);
  });
});

describe("update payload", () => {
  // Seconds on the stored time must survive when the date field isn't touched.
  const original = night({ starts_at: "2026-11-27T20:15:42Z", notes: null });

  test("contains exactly the four editable fields", () => {
    const payload = buildUpdatePayload(toEditFormValues(original), original);
    expect(Object.keys(payload).sort()).toEqual(["location", "name", "notes", "starts_at"]);
  });

  test("untouched fields are sent back exactly as stored", () => {
    expect(buildUpdatePayload(toEditFormValues(original), original)).toEqual({
      name: original.name,
      starts_at: "2026-11-27T20:15:42Z",
      location: original.location,
      notes: null,
    });
    expect(hasEditChanges(toEditFormValues(original), original)).toBe(false);
  });

  test("edited text is trimmed, empty notes become null, a new time is sent as UTC", () => {
    const payload = buildUpdatePayload(
      { name: "  Co-op Night ", startsAt: "2026-12-05T19:30", location: " Cafe ", notes: "   " },
      night(),
    );
    expect(payload).toEqual({
      name: "Co-op Night",
      starts_at: "2026-12-06T03:30:00.000Z",
      location: "Cafe",
      notes: null,
    });
  });

  test("hasEditChanges spots each kind of change", () => {
    const base = toEditFormValues(original);
    expect(hasEditChanges({ ...base, name: "New" }, original)).toBe(true);
    expect(hasEditChanges({ ...base, location: "Elsewhere" }, original)).toBe(true);
    expect(hasEditChanges({ ...base, notes: "Snacks" }, original)).toBe(true);
    expect(hasEditChanges({ ...base, startsAt: "2026-12-24T18:00" }, original)).toBe(true);
    // Whitespace-only notes on a night without notes is still "no notes".
    expect(hasEditChanges({ ...base, notes: "  " }, original)).toBe(false);
  });

  test("throws if called with an invalid new time (callers validate first)", () => {
    expect(() => buildUpdatePayload({ ...toEditFormValues(original), startsAt: "nope" }, original)).toThrow();
  });
});

describe("getServerFieldErrors", () => {
  function axios422(data: unknown, status = 422) {
    const config = { headers: new AxiosHeaders({ Authorization: "Bearer secret" }) };
    return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, {
      status,
      statusText: "",
      headers: {},
      config,
      data,
    });
  }

  test("maps FastAPI 422 details to form fields", () => {
    const errors = getServerFieldErrors(
      axios422({
        detail: [
          { loc: ["body", "name"], msg: "String should have at least 1 character" },
          { loc: ["body", "starts_at"], msg: "Input should have timezone info" },
        ],
      }),
    );
    expect(errors).toEqual({
      name: "String should have at least 1 character",
      startsAt: "Invalid date and time: Input should have timezone info",
    });
  });

  test("ignores unknown fields, malformed bodies and other statuses", () => {
    expect(getServerFieldErrors(axios422({ detail: [{ loc: ["body", "game_ids"], msg: "Extra inputs" }] }))).toEqual({});
    expect(getServerFieldErrors(axios422({ detail: "Only the host can perform this action" }))).toEqual({});
    expect(getServerFieldErrors(axios422({ detail: [{ loc: ["body", "name"] }] }, 403))).toEqual({});
    expect(getServerFieldErrors(new Error("x"))).toEqual({});
    expect(getServerFieldErrors(axios422(null))).toEqual({});
  });
});

describe("error handling", () => {
  test("loading: 404 and 403 are not retryable; network and server errors are", () => {
    expect(describeLoadError(info("not_found")).retryable).toBe(false);
    expect(describeLoadError(info("forbidden")).retryable).toBe(false);
    expect(describeLoadError(info("not_found")).title).toBe("Game night not found");
    expect(describeLoadError(info("unauthorized")).retryable).toBe(false);
    expect(describeLoadError(info("network")).retryable).toBe(true);
    expect(describeLoadError(info("server")).retryable).toBe(true);
  });

  test("saving: 404 means gone, 403 reloads the role, others keep the form", () => {
    expect(describeUpdateError(info("not_found")).outcome).toBe("gone");
    expect(describeUpdateError(info("forbidden"))).toEqual({
      message: "Only the host can edit this game night.",
      outcome: "reload",
    });
    expect(describeUpdateError(info("validation")).outcome).toBe("none");
    expect(describeUpdateError(info("network")).message).toContain("Your edits are still here");
    expect(describeUpdateError(info("server")).outcome).toBe("none");
    expect(describeUpdateError(info("canceled")).message).toBe("");
  });

  test("deleting: an already-deleted night counts as gone; failures keep the page", () => {
    expect(describeDeleteError(info("not_found")).outcome).toBe("gone");
    expect(describeDeleteError(info("forbidden")).outcome).toBe("reload");
    expect(describeDeleteError(info("network")).outcome).toBe("none");
    expect(describeDeleteError(info("server")).message).toContain("wasn't deleted");
  });

  test("leaving: 404 is gone, 403 reloads", () => {
    expect(describeLeaveError(info("not_found")).outcome).toBe("gone");
    expect(describeLeaveError(info("forbidden")).outcome).toBe("reload");
    expect(describeLeaveError(info("network")).outcome).toBe("none");
  });

  test("inviting and game actions explain 409/403/404", () => {
    expect(describeInviteError(info("conflict"), "Sam").message).toBe("Sam is already on this game night.");
    expect(describeInviteError(info("forbidden"), "Sam").outcome).toBe("reload");
    expect(describeGameActionError(info("conflict"), "add", "Azul").message).toBe("Azul is already selected.");
    expect(describeGameActionError(info("forbidden"), "add", "Azul").message).toContain("no accepted attendee owns it");
    expect(describeGameActionError(info("not_found"), "remove", "Azul").message).toBe("Azul was already removed.");
  });

  test("session expiry gets the same message everywhere", () => {
    const expired = "Your session has expired. Please log in again.";
    expect(describeUpdateError(info("unauthorized")).message).toBe(expired);
    expect(describeDeleteError(info("unauthorized")).message).toBe(expired);
    expect(describeLeaveError(info("unauthorized")).message).toBe(expired);
  });
});
