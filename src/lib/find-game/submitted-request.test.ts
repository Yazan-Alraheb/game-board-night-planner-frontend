/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { beforeEach, describe, expect, test } from "bun:test";
import { installMemorySessionStorage } from "@/test-utils/memory-session-storage";
import {
  clearSubmittedRequest,
  isSameRequest,
  loadSubmittedRequest,
  parseRecommendationRequest,
  saveSubmittedRequest,
} from "@/lib/find-game/submitted-request";
import type { RecommendationRequest } from "@/types/recommendation";

const storage = installMemorySessionStorage();
const KEY = "gamenight_submitted_recommendation_request";

const personal: RecommendationRequest = {
  mode: "personal",
  player_count: 3,
  max_playtime: 60,
  categories: ["Strategy"],
  experience_level: "Beginner",
};
const gameNight: RecommendationRequest = { mode: "game_night", game_night_id: 12, max_playtime: 90 };

/** Writes a raw stored snapshot, as if it had been saved earlier or edited. */
function storeRaw(request: unknown, overrides: Record<string, unknown> = {}) {
  storage.store.set(
    KEY,
    JSON.stringify({ version: 1, userId: 1, submittedAt: "2026-11-25T10:00:00.000Z", request, ...overrides }),
  );
}

beforeEach(() => storage.reset());

describe("submitted request snapshot", () => {
  test("round-trips both modes for the same user", () => {
    expect(saveSubmittedRequest(1, personal, new Date("2026-11-25T10:00:00Z"))).toBe(true);
    expect(loadSubmittedRequest(1)).toEqual({
      status: "ok",
      snapshot: { userId: 1, submittedAt: "2026-11-25T10:00:00.000Z", request: personal },
    });

    saveSubmittedRequest(1, gameNight);
    expect(loadSubmittedRequest(1)).toMatchObject({ status: "ok", snapshot: { request: gameNight } });
  });

  test("the loaded snapshot is read-only", () => {
    saveSubmittedRequest(1, personal);
    const result = loadSubmittedRequest(1);
    if (result.status !== "ok") throw new Error("expected ok");

    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.request)).toBe(true);
    expect(Object.isFrozen(result.snapshot.request.categories)).toBe(true);
  });

  test("submitting again overwrites the previous snapshot", () => {
    saveSubmittedRequest(1, personal);
    saveSubmittedRequest(1, gameNight);
    expect(storage.store.size).toBe(1);
    expect(JSON.parse(storage.store.get(KEY)!).request).toEqual(gameNight);
  });

  test("stores only the request fields: extra fields are rejected and nothing token-like is kept", () => {
    const withExtras = { ...gameNight, access_token: "secret" } as unknown as RecommendationRequest;
    expect(saveSubmittedRequest(1, withExtras)).toBe(false);
    expect(storage.store.has(KEY)).toBe(false);

    saveSubmittedRequest(1, personal);
    expect(Object.keys(JSON.parse(storage.store.get(KEY)!)).sort()).toEqual([
      "request",
      "submittedAt",
      "userId",
      "version",
    ]);
    expect(storage.store.get(KEY)).not.toMatch(/token|bearer|password|email/i);
  });

  test("is missing when nothing was submitted", () => {
    expect(loadSubmittedRequest(1)).toEqual({ status: "missing" });
  });

  test("another user's snapshot is stale and removed", () => {
    saveSubmittedRequest(2, personal);
    expect(loadSubmittedRequest(1)).toEqual({ status: "stale" });
    expect(storage.store.has(KEY)).toBe(false);
  });

  test("an older storage version is stale and removed", () => {
    storeRaw(personal, { version: 0 });
    expect(loadSubmittedRequest(1)).toEqual({ status: "stale" });
    expect(storage.store.has(KEY)).toBe(false);
  });

  test("blocked storage: saving reports failure, loading reports missing", () => {
    storage.setBlocked(true);
    expect(saveSubmittedRequest(1, personal)).toBe(false);
    expect(loadSubmittedRequest(1)).toEqual({ status: "missing" });
  });

  test("clearSubmittedRequest removes it", () => {
    saveSubmittedRequest(1, personal);
    clearSubmittedRequest();
    expect(loadSubmittedRequest(1)).toEqual({ status: "missing" });
  });
});

describe("stored request validation (matches the backend contract)", () => {
  const invalid: Array<[string, unknown]> = [
    ["null experience_level", { ...personal, experience_level: null }],
    ["unknown experience_level", { ...personal, experience_level: "Expert" }],
    ["game_night_id in personal mode", { ...personal, game_night_id: 3 }],
    ["personal mode without player_count", { mode: "personal", max_playtime: 60 }],
    ["game-night mode without game_night_id", { mode: "game_night", max_playtime: 60 }],
    ["numeric string", { ...gameNight, game_night_id: "12" }],
    ["non-integer", { ...gameNight, max_playtime: 60.5 }],
    ["zero", { ...gameNight, max_playtime: 0 }],
    ["above the backend maximum", { ...gameNight, max_playtime: 2147483648 }],
    ["blank category", { ...gameNight, categories: [" "] }],
    ["empty categories array", { ...gameNight, categories: [] }],
    ["more than 50 categories", { ...gameNight, categories: Array.from({ length: 51 }, (_, i) => `c${i}`) }],
    ["unknown field", { ...gameNight, token: "x" }],
    ["unknown mode", { ...gameNight, mode: "group" }],
  ];

  test.each(invalid)("rejects %s (and removes it from storage)", (_name, request) => {
    expect(parseRecommendationRequest(request)).toBeNull();
    storeRaw(request);
    expect(loadSubmittedRequest(1)).toEqual({ status: "invalid" });
    expect(storage.store.has(KEY)).toBe(false);
  });

  test("rejects corrupt JSON and invalid timestamps", () => {
    storage.store.set(KEY, "{not json");
    expect(loadSubmittedRequest(1)).toEqual({ status: "invalid" });

    storeRaw(personal, { submittedAt: "yesterday" });
    expect(loadSubmittedRequest(1)).toEqual({ status: "invalid" });
  });

  test("isSameRequest ignores key order and detects changes", () => {
    const reordered = { max_playtime: 90, game_night_id: 12, mode: "game_night" } as RecommendationRequest;
    expect(isSameRequest(reordered, gameNight)).toBe(true);
    expect(isSameRequest(gameNight, { ...gameNight, max_playtime: 30 })).toBe(false);
  });
});
