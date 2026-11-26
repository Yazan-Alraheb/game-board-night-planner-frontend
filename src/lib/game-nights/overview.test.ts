/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import type { ApiErrorInfo } from "@/api/errors";
import {
  applyRsvpStatus,
  canRespondToInvitation,
  describeRsvpError,
  findHost,
  getAvailableAnswers,
  getMyStatus,
  groupGameNights,
  summarizeAttendees,
  type MembersState,
  type OverviewEntry,
} from "@/lib/game-nights/overview";
import type { GameNightMember, GameNightMemberStatus, GameNightResponse } from "@/types/game-night";

const ME = 1;
const NOW = new Date("2026-11-25T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

function user(id: number) {
  return { id, name: `User ${id}`, username: `user_${id}`, bio: null, avatar_url: null };
}

function member(id: number, status: GameNightMemberStatus): GameNightMember {
  return { user: user(id), status };
}

function night(id: number, hoursFromNow: number, hostId = 2): GameNightResponse {
  return {
    id,
    host_id: hostId,
    name: `Night ${id}`,
    starts_at: new Date(NOW + hoursFromNow * HOUR).toISOString(),
    location: "Somewhere",
    notes: null,
    created_at: "2026-11-01T00:00:00Z",
  };
}

const loaded = (members: GameNightMember[]): MembersState => ({ status: "success", members });

/** A night hosted by user 2 where the current user has `myStatus`. */
function invitedEntry(id: number, hoursFromNow: number, myStatus: GameNightMemberStatus): OverviewEntry {
  return {
    gameNight: night(id, hoursFromNow),
    members: loaded([member(2, "accepted"), member(ME, myStatus)]),
  };
}

function hostedEntry(id: number, hoursFromNow: number): OverviewEntry {
  return {
    gameNight: night(id, hoursFromNow, ME),
    members: loaded([member(ME, "accepted"), member(3, "pending")]),
  };
}

const ids = (entries: OverviewEntry[]) => entries.map((entry) => entry.gameNight.id);

describe("getMyStatus", () => {
  test("host_id decides hosting, even before members load", () => {
    expect(getMyStatus(night(1, 5, ME), ME, null)).toBe("hosting");
    expect(getMyStatus(night(1, 5, ME), ME, [member(ME, "accepted")])).toBe("hosting");
  });

  test("maps the user's own membership status", () => {
    expect(getMyStatus(night(1, 5), ME, [member(ME, "accepted")])).toBe("going");
    expect(getMyStatus(night(1, 5), ME, [member(ME, "pending")])).toBe("invited");
    expect(getMyStatus(night(1, 5), ME, [member(ME, "declined")])).toBe("declined");
  });

  test("reads only the current user's row, not other members'", () => {
    expect(getMyStatus(night(1, 5), ME, [member(4, "accepted"), member(ME, "pending")])).toBe("invited");
  });

  test("never guesses: unknown when members are missing or the user isn't listed", () => {
    expect(getMyStatus(night(1, 5), ME, null)).toBeNull();
    expect(getMyStatus(night(1, 5), ME, [member(2, "accepted")])).toBeNull();
  });
});

describe("groupGameNights", () => {
  const entries: OverviewEntry[] = [
    invitedEntry(10, 48, "accepted"),
    hostedEntry(11, 2),
    invitedEntry(12, 24, "pending"),
    invitedEntry(13, 5, "pending"),
    invitedEntry(14, 10, "declined"),
    invitedEntry(15, -48, "declined"),
    invitedEntry(16, -2, "accepted"),
    hostedEntry(17, -100),
    invitedEntry(18, -5, "pending"),
    { gameNight: night(19, 30), members: { status: "error" } },
  ];
  const groups = groupGameNights(entries, ME, NOW);

  test("upcoming: hosted and accepted future nights, soonest first", () => {
    expect(ids(groups.upcoming)).toEqual([11, 19, 10]);
  });

  test("invitations: future pending invitations only, soonest first", () => {
    expect(ids(groups.invitations)).toEqual([13, 12]);
  });

  test("past: started nights latest first, without declined ones", () => {
    expect(ids(groups.past)).toEqual([16, 18, 17]);
  });

  test("declined: future first (soonest), then past (latest)", () => {
    expect(ids(groups.declined)).toEqual([14, 15]);
  });

  test("declined nights never appear in upcoming or invitations", () => {
    const active = [...groups.upcoming, ...groups.invitations].map((entry) => entry.gameNight.id);
    expect(active).not.toContain(14);
    expect(active).not.toContain(15);
  });

  test("every night lands in exactly one tab", () => {
    const all = [...groups.upcoming, ...groups.invitations, ...groups.past, ...groups.declined];
    expect(ids(all).sort((a, b) => a - b)).toEqual(ids(entries).sort((a, b) => a - b));
  });

  test("does not mutate the input order", () => {
    expect(ids(entries)[0]).toBe(10);
  });
});

describe("canRespondToInvitation", () => {
  const members = (status: GameNightMemberStatus) => [member(2, "accepted"), member(ME, status)];

  test("only for the user's own pending invitation to a future night", () => {
    expect(canRespondToInvitation(night(1, 5), ME, members("pending"), NOW)).toBe(true);
  });

  test("hidden for accepted, declined, past, unknown and hosted nights", () => {
    expect(canRespondToInvitation(night(1, 5), ME, members("accepted"), NOW)).toBe(false);
    expect(canRespondToInvitation(night(1, 5), ME, members("declined"), NOW)).toBe(false);
    expect(canRespondToInvitation(night(1, -5), ME, members("pending"), NOW)).toBe(false);
    expect(canRespondToInvitation(night(1, 5), ME, null, NOW)).toBe(false);
    expect(canRespondToInvitation(night(1, 5, ME), ME, [member(ME, "pending")], NOW)).toBe(false);
  });

  test("another member's pending invitation doesn't show controls", () => {
    expect(
      canRespondToInvitation(night(1, 5), ME, [member(ME, "accepted"), member(3, "pending")], NOW),
    ).toBe(false);
  });
});

describe("getAvailableAnswers", () => {
  const members = (status: GameNightMemberStatus) => [member(2, "accepted"), member(ME, status)];

  test("pending future invitation: Accept or Decline", () => {
    expect(getAvailableAnswers(night(1, 5), ME, members("pending"), NOW)).toEqual(["accepted", "declined"]);
  });

  test("declined future invitation: Accept only, so the user can change their mind", () => {
    expect(getAvailableAnswers(night(1, 5), ME, members("declined"), NOW)).toEqual(["accepted"]);
    expect(canRespondToInvitation(night(1, 5), ME, members("declined"), NOW)).toBe(false);
  });

  test("accepted future invitation: Decline only, for when the user can't make it", () => {
    expect(getAvailableAnswers(night(1, 5), ME, members("accepted"), NOW)).toEqual(["declined"]);
    expect(canRespondToInvitation(night(1, 5), ME, members("accepted"), NOW)).toBe(false);
  });

  test("the host can never decline their own night", () => {
    expect(getAvailableAnswers(night(1, 5, ME), ME, [member(ME, "accepted")], NOW)).toEqual([]);
  });

  test("nothing for past, unknown or hosted nights", () => {
    expect(getAvailableAnswers(night(1, -5), ME, members("accepted"), NOW)).toEqual([]);
    expect(getAvailableAnswers(night(1, -5), ME, members("declined"), NOW)).toEqual([]);
    expect(getAvailableAnswers(night(1, -5), ME, members("pending"), NOW)).toEqual([]);
    expect(getAvailableAnswers(night(1, 5), ME, null, NOW)).toEqual([]);
    expect(getAvailableAnswers(night(1, 5, ME), ME, [member(ME, "accepted")], NOW)).toEqual([]);
  });
});

describe("summarizeAttendees / findHost", () => {
  const members = [
    member(5, "accepted"),
    member(3, "pending"),
    member(2, "accepted"),
    member(4, "declined"),
    member(6, "pending"),
  ];

  test("counts only accepted members as going, host first", () => {
    const summary = summarizeAttendees(members, 2);
    expect(summary.going.map((person) => person.id)).toEqual([2, 5]);
    expect(summary.pendingCount).toBe(2);
  });

  test("declined members are not counted", () => {
    expect(summarizeAttendees([member(4, "declined")], 2)).toEqual({ going: [], pendingCount: 0 });
  });

  test("findHost returns the backend's host profile or null", () => {
    expect(findHost(members, 2)?.name).toBe("User 2");
    expect(findHost(members, 99)).toBeNull();
  });
});

describe("state after an RSVP", () => {
  const before = invitedEntry(20, 24, "pending");

  function regroupWith(status: GameNightMemberStatus) {
    const members = before.members.status === "success" ? before.members.members : [];
    const after: OverviewEntry = { ...before, members: loaded(applyRsvpStatus(members, ME, status)) };
    return { after, groups: groupGameNights([after], ME, NOW) };
  }

  test("accepting moves the night from Invitations to Upcoming and counts the user", () => {
    const { after, groups } = regroupWith("accepted");
    expect(ids(groups.upcoming)).toEqual([20]);
    expect(groups.invitations).toEqual([]);
    const members = after.members.status === "success" ? after.members.members : [];
    expect(summarizeAttendees(members, 2).going.map((person) => person.id)).toEqual([2, ME]);
    expect(canRespondToInvitation(after.gameNight, ME, members, NOW)).toBe(false);
  });

  test("declining moves it to Declined, out of Upcoming and Invitations", () => {
    const { groups } = regroupWith("declined");
    expect(ids(groups.declined)).toEqual([20]);
    expect(groups.upcoming).toEqual([]);
    expect(groups.invitations).toEqual([]);
  });

  test("accepting a declined invitation moves it from Declined to Upcoming", () => {
    const declined = invitedEntry(21, 24, "declined");
    expect(ids(groupGameNights([declined], ME, NOW).declined)).toEqual([21]);

    const members = declined.members.status === "success" ? declined.members.members : [];
    const accepted = applyRsvpStatus(members, ME, "accepted");
    const groups = groupGameNights([{ ...declined, members: loaded(accepted) }], ME, NOW);

    expect(ids(groups.upcoming)).toEqual([21]);
    expect(groups.declined).toEqual([]);
    expect(summarizeAttendees(accepted, 2).going.map((person) => person.id)).toEqual([2, ME]);
    expect(getAvailableAnswers(declined.gameNight, ME, accepted, NOW)).toEqual(["declined"]);
  });

  test("declining an accepted invitation moves it from Upcoming to Declined", () => {
    const going = invitedEntry(22, 24, "accepted");
    expect(ids(groupGameNights([going], ME, NOW).upcoming)).toEqual([22]);

    const members = going.members.status === "success" ? going.members.members : [];
    const declined = applyRsvpStatus(members, ME, "declined");
    const groups = groupGameNights([{ ...going, members: loaded(declined) }], ME, NOW);

    expect(ids(groups.declined)).toEqual([22]);
    expect(groups.upcoming).toEqual([]);
    expect(summarizeAttendees(declined, 2).going.map((person) => person.id)).toEqual([2]);
    expect(getAvailableAnswers(going.gameNight, ME, declined, NOW)).toEqual(["accepted"]);
  });

  test("applyRsvpStatus does not touch other members or the input", () => {
    const members = [member(2, "accepted"), member(ME, "pending"), member(3, "pending")];
    const updated = applyRsvpStatus(members, ME, "accepted");
    expect(updated.map((entry) => entry.status)).toEqual(["accepted", "accepted", "pending"]);
    expect(members[1].status).toBe("pending");
  });

  test("applyRsvpStatus leaves the list unchanged when the user was removed", () => {
    const members = [member(2, "accepted")];
    expect(applyRsvpStatus(members, ME, "accepted")).toBe(members);
  });

  test("an invitation answered elsewhere is reclassified from refreshed members", () => {
    const refreshed: OverviewEntry = { ...before, members: loaded([member(2, "accepted"), member(ME, "declined")]) };
    expect(ids(groupGameNights([refreshed], ME, NOW).declined)).toEqual([20]);
    expect(getAvailableAnswers(refreshed.gameNight, ME, [member(ME, "declined")], NOW)).toEqual(["accepted"]);
  });
});

describe("describeRsvpError", () => {
  const error = (kind: ApiErrorInfo["kind"], status: number | null = null): ApiErrorInfo => ({
    kind,
    status,
    detail: null,
  });

  test("404 and 403 mean the night or invitation is gone: refresh the list", () => {
    expect(describeRsvpError(error("not_found", 404), "accepted").refresh).toBe("list");
    expect(describeRsvpError(error("forbidden", 403), "declined").refresh).toBe("list");
  });

  test("409, 400 and 422 re-check the night's members", () => {
    expect(describeRsvpError(error("conflict", 409), "accepted").refresh).toBe("members");
    expect(describeRsvpError(error("bad_request", 400), "accepted").refresh).toBe("members");
    expect(describeRsvpError(error("validation", 422), "declined").refresh).toBe("members");
  });

  test("network errors and 5xx re-check quietly in case the request went through", () => {
    expect(describeRsvpError(error("network"), "accepted").refresh).toBe("members");
    expect(describeRsvpError(error("server", 500), "accepted").message).toContain("accept");
  });

  test("401 relies on the existing session handling; canceled is silent", () => {
    expect(describeRsvpError(error("unauthorized", 401), "accepted")).toEqual({
      message: "Your session has expired. Please log in again.",
      refresh: "none",
    });
    expect(describeRsvpError(error("canceled"), "accepted").message).toBe("");
  });

  test("messages name the attempted action", () => {
    expect(describeRsvpError(error("validation", 422), "declined").message).toContain("decline");
  });
});
