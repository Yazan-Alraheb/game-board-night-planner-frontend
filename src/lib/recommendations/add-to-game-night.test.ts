/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import type { ApiErrorInfo, ApiErrorKind } from "@/api/errors";
import type { LazyResource } from "@/hooks/useLazyResource";
import {
  HOST_ONLY_DETAIL,
  classifyAddFailure,
  resolveAddControlsAccess,
} from "@/lib/recommendations/add-to-game-night";
import type { GameNightResponse } from "@/types/game-night";

function apiError(kind: ApiErrorKind, detail: string | null = null): ApiErrorInfo {
  return { kind, detail, status: null };
}

function loadedGameNight(hostId: number): LazyResource<GameNightResponse> {
  return {
    status: "success",
    data: {
      id: 1,
      host_id: hostId,
      name: "Friday Night",
      starts_at: "2026-12-01T19:00:00Z",
      location: "Home",
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  };
}

describe("resolveAddControlsAccess: host-only Add controls", () => {
  test("the host gets Add controls", () => {
    expect(resolveAddControlsAccess(loadedGameNight(1), 1)).toEqual({ kind: "host" });
  });

  test("an accepted guest gets no Add controls", () => {
    expect(resolveAddControlsAccess(loadedGameNight(1), 2)).toEqual({ kind: "guest" });
  });

  test("while host info loads, nobody gets controls (no flash for guests)", () => {
    expect(resolveAddControlsAccess({ status: "idle" }, 1)).toEqual({ kind: "checking" });
    expect(resolveAddControlsAccess({ status: "loading" }, 1)).toEqual({ kind: "checking" });
  });

  test("if host info fails to load, nobody gets controls", () => {
    expect(resolveAddControlsAccess({ status: "error", error: apiError("network") }, 1)).toEqual({
      kind: "unknown",
    });
  });
});

describe("classifyAddFailure: which failures affect the whole event", () => {
  test("only the backend's exact host-only 403 is event-wide", () => {
    expect(classifyAddFailure(apiError("forbidden", HOST_ONLY_DETAIL))).toEqual({
      scope: "event",
      message: "Only the host can add games to this game night.",
    });
  });

  test("a game-specific 403 stays on that card and cannot be retried", () => {
    expect(classifyAddFailure(apiError("forbidden", "Game is not owned by an accepted attendee"))).toMatchObject({
      scope: "game",
      retryable: false,
    });
  });

  test.each([
    ["an unknown detail", "Something new"],
    ["no detail", null],
    ["different capitalisation", HOST_ONLY_DETAIL.toLowerCase()],
  ])("a 403 with %s is never treated as event-wide", (_name, detail) => {
    expect(classifyAddFailure(apiError("forbidden", detail)).scope).toBe("game");
  });

  test("409 means the game is already in the event", () => {
    expect(classifyAddFailure(apiError("conflict", "Game is already selected"))).toEqual({ scope: "already" });
  });

  test.each<[ApiErrorKind, boolean]>([
    ["network", true],
    ["server", true],
    ["unauthorized", false],
    ["not_found", false],
    ["validation", false],
    ["bad_request", false],
  ])("%s errors: retryable = %p", (kind, retryable) => {
    expect(classifyAddFailure(apiError(kind))).toMatchObject({ scope: "game", retryable });
  });

  test("messages never repeat raw backend text", () => {
    const failure = classifyAddFailure(apiError("forbidden", "Bearer abc.def secret"));
    expect(failure.scope === "game" && failure.message).not.toMatch(/bearer|secret/i);
  });
});
