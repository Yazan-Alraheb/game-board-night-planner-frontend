/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import {
  getGameNightRole,
  hasDeclined,
  selectUpcomingGameNights,
  selectVisibleGameNights,
  summarizeAttendees,
} from "@/lib/home/upcoming-game-nights";
import type { PublicUser } from "@/types/friend";
import type { GameNightMember, GameNightMemberStatus, GameNightResponse } from "@/types/game-night";

const ME = 1;
const NOW = Date.parse("2026-11-25T12:00:00Z");

function gameNight(id: number, startsAt: string, hostId = 99): GameNightResponse {
  return {
    id,
    host_id: hostId,
    name: `Night ${id}`,
    starts_at: startsAt,
    location: "Somewhere",
    notes: null,
    created_at: "2026-11-01T00:00:00Z",
  };
}

// The intersection keeps this fixture valid both before and after `username`
// becomes a required field on PublicUser; simplify to `PublicUser` once it has.
function user(id: number): PublicUser & { username: string } {
  return { id, name: `User ${id}`, username: `user_${id}`, bio: null, avatar_url: null };
}

function member(userId: number, status: GameNightMemberStatus): GameNightMember {
  return { user: user(userId), status };
}

const ids = (nights: readonly { id: number }[]) => nights.map((night) => night.id);

describe("selectUpcomingGameNights", () => {
  test("sorts upcoming events chronologically, regardless of input order", () => {
    const nights = [
      gameNight(1, "2026-12-10T18:00:00Z"),
      gameNight(2, "2026-11-26T18:00:00Z"),
      gameNight(3, "2026-12-01T18:00:00Z"),
    ];
    expect(ids(selectUpcomingGameNights(nights, NOW))).toEqual([2, 3, 1]);
  });

  test("compares instants, not strings, when offsets differ", () => {
    // 08:00+02:00 is 06:00Z, so it comes before 07:00Z on the same day.
    const nights = [gameNight(1, "2026-11-26T07:00:00Z"), gameNight(2, "2026-11-26T08:00:00+02:00")];
    expect(ids(selectUpcomingGameNights(nights, NOW))).toEqual([2, 1]);
  });

  test("excludes past events", () => {
    const nights = [
      gameNight(1, "2026-11-24T18:00:00Z"),
      gameNight(2, "2026-11-26T18:00:00Z"),
      gameNight(3, "2025-12-31T18:00:00Z"),
    ];
    expect(ids(selectUpcomingGameNights(nights, NOW))).toEqual([2]);
  });

  test("an event that started a moment ago is past; one starting exactly now is upcoming", () => {
    const nights = [gameNight(1, "2026-11-25T11:59:59Z"), gameNight(2, "2026-11-25T12:00:00Z")];
    expect(ids(selectUpcomingGameNights(nights, NOW))).toEqual([2]);
  });

  test("handles an empty list and a list with only past events", () => {
    expect(selectUpcomingGameNights([], NOW)).toEqual([]);
    expect(selectUpcomingGameNights([gameNight(1, "2026-01-01T00:00:00Z")], NOW)).toEqual([]);
  });

  test("does not mutate the input array", () => {
    const nights = [gameNight(1, "2026-12-10T18:00:00Z"), gameNight(2, "2026-11-26T18:00:00Z")];
    selectUpcomingGameNights(nights, NOW);
    expect(ids(nights)).toEqual([1, 2]);
  });
});

/** A fake members API that records which nights were requested. */
function fakeMembersApi(byNight: Record<number, GameNightMember[] | "fail">) {
  const requested: number[] = [];
  const fetchMembers = async (gameNightId: number) => {
    requested.push(gameNightId);
    const result = byNight[gameNightId] ?? [];
    if (result === "fail") throw new Error("members request failed");
    return result;
  };
  return { fetchMembers, requested };
}

const upcoming = (...nightIds: number[]) =>
  nightIds.map((id) => gameNight(id, `2026-12-${String(id).padStart(2, "0")}T18:00:00Z`));

describe("selectVisibleGameNights", () => {
  test("shows only the next two events and reports that more exist", async () => {
    const api = fakeMembersApi({});
    const result = await selectVisibleGameNights(upcoming(1, 2, 3, 4), ME, 2, api.fetchMembers);

    expect(ids(result.shown.map((entry) => entry.gameNight))).toEqual([1, 2]);
    expect(result.hasMore).toBe(true);
  });

  test("fetches members only for the shown nights plus one to confirm 'more'", async () => {
    const api = fakeMembersApi({});
    await selectVisibleGameNights(upcoming(1, 2, 3, 4, 5), ME, 2, api.fetchMembers);
    expect(api.requested).toEqual([1, 2, 3]);
  });

  test("excludes nights the user declined and fills the gap with the next one", async () => {
    const api = fakeMembersApi({ 1: [member(ME, "declined")], 3: [member(ME, "declined")] });
    const result = await selectVisibleGameNights(upcoming(1, 2, 3, 4, 5), ME, 2, api.fetchMembers);

    expect(ids(result.shown.map((entry) => entry.gameNight))).toEqual([2, 4]);
    expect(result.hasMore).toBe(true);
    expect(api.requested).toEqual([1, 2, 3, 4, 5]);
  });

  test("someone else declining does not hide the night", async () => {
    const api = fakeMembersApi({ 1: [member(ME, "accepted"), member(7, "declined")] });
    const result = await selectVisibleGameNights(upcoming(1), ME, 2, api.fetchMembers);
    expect(ids(result.shown.map((entry) => entry.gameNight))).toEqual([1]);
  });

  test("'more' is false when the only remaining nights were declined", async () => {
    const api = fakeMembersApi({ 3: [member(ME, "declined")], 4: [member(ME, "declined")] });
    const result = await selectVisibleGameNights(upcoming(1, 2, 3, 4), ME, 2, api.fetchMembers);

    expect(ids(result.shown.map((entry) => entry.gameNight))).toEqual([1, 2]);
    expect(result.hasMore).toBe(false);
  });

  test("all nights declined gives an empty result (the empty state)", async () => {
    const api = fakeMembersApi({ 1: [member(ME, "declined")], 2: [member(ME, "declined")] });
    expect(await selectVisibleGameNights(upcoming(1, 2), ME, 2, api.fetchMembers)).toEqual({
      shown: [],
      hasMore: false,
    });
  });

  test("an empty list makes no members requests", async () => {
    const api = fakeMembersApi({});
    expect(await selectVisibleGameNights([], ME, 2, api.fetchMembers)).toEqual({ shown: [], hasMore: false });
    expect(api.requested).toEqual([]);
  });

  test("fewer nights than the limit are all shown, with no 'more'", async () => {
    const api = fakeMembersApi({});
    const result = await selectVisibleGameNights(upcoming(1), ME, 2, api.fetchMembers);
    expect(result.shown).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  test("a failed members request keeps the night, with members: null", async () => {
    const api = fakeMembersApi({ 1: "fail", 2: [member(ME, "accepted")] });
    const result = await selectVisibleGameNights(upcoming(1, 2), ME, 2, api.fetchMembers);

    expect(result.shown.map((entry) => entry.members)).toEqual([null, [member(ME, "accepted")]]);
  });

  test("keeps the attached members so cards don't refetch them", async () => {
    const members = [member(ME, "accepted"), member(2, "pending")];
    const api = fakeMembersApi({ 1: members });
    const result = await selectVisibleGameNights(upcoming(1), ME, 2, api.fetchMembers);
    expect(result.shown[0]?.members).toEqual(members);
  });

  test("stops with an AbortError when the request is cancelled", async () => {
    const controller = new AbortController();
    const fetchMembers = async () => {
      controller.abort();
      return [];
    };
    await expect(
      selectVisibleGameNights(upcoming(1, 2, 3), ME, 2, fetchMembers, controller.signal),
    ).rejects.toThrow();
  });
});

describe("hasDeclined", () => {
  test("only the user's own declined membership counts", () => {
    expect(hasDeclined([member(ME, "declined")], ME)).toBe(true);
    expect(hasDeclined([member(ME, "pending"), member(2, "declined")], ME)).toBe(false);
    expect(hasDeclined([], ME)).toBe(false);
  });
});

describe("getGameNightRole", () => {
  const hosted = gameNight(1, "2026-12-01T18:00:00Z", ME);
  const invitedTo = gameNight(2, "2026-12-01T18:00:00Z", 5);

  test("Hosting comes from host_id, even without members", () => {
    expect(getGameNightRole(hosted, ME, null)).toBe("hosting");
    expect(getGameNightRole(hosted, ME, [member(ME, "accepted")])).toBe("hosting");
  });

  test("an accepted invitation is Going", () => {
    expect(getGameNightRole(invitedTo, ME, [member(5, "accepted"), member(ME, "accepted")])).toBe("going");
  });

  test("a pending invitation is Invited", () => {
    expect(getGameNightRole(invitedTo, ME, [member(ME, "pending")])).toBe("invited");
  });

  test("falls back to Invited when members are unknown or the user isn't listed", () => {
    expect(getGameNightRole(invitedTo, ME, null)).toBe("invited");
    expect(getGameNightRole(invitedTo, ME, [member(5, "accepted")])).toBe("invited");
  });

  test("another user's status never changes the current user's role", () => {
    expect(getGameNightRole(invitedTo, ME, [member(ME, "pending"), member(3, "accepted")])).toBe("invited");
  });
});

describe("summarizeAttendees", () => {
  test("counts accepted members as going, including the host", () => {
    // The backend stores the host as an accepted member.
    const summary = summarizeAttendees([member(5, "accepted"), member(ME, "accepted")]);
    expect(summary.going.map((person) => person.id)).toEqual([5, ME]);
  });

  test("counts pending invitations separately from going", () => {
    const summary = summarizeAttendees([member(5, "accepted"), member(2, "pending"), member(3, "pending")]);
    expect(summary.going).toHaveLength(1);
    expect(summary.pendingCount).toBe(2);
  });

  test("declined members are neither going nor pending", () => {
    const summary = summarizeAttendees([member(5, "accepted"), member(2, "declined")]);
    expect(summary.going.map((person) => person.id)).toEqual([5]);
    expect(summary.pendingCount).toBe(0);
  });

  test("handles an empty member list", () => {
    expect(summarizeAttendees([])).toEqual({ going: [], pendingCount: 0 });
  });
});
