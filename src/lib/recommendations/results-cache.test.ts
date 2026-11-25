/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { beforeEach, describe, expect, test } from "bun:test";
import { installMemorySessionStorage } from "@/test-utils/memory-session-storage";
import { INITIAL_ANSWERS } from "@/lib/find-game/questionnaire";
import { loadDraft, saveDraft } from "@/lib/find-game/storage";
import {
  loadSubmittedRequest,
  saveSubmittedRequest,
  type SubmittedRequestSnapshot,
} from "@/lib/find-game/submitted-request";
import {
  answersFromRequest,
  draftDiffersFromRequest,
  prepareDraftForEditing,
  startOver,
} from "@/lib/recommendations/handoff";
import { parseRecommendationList } from "@/lib/recommendations/parse";
import { loadCachedResults, saveCachedResults } from "@/lib/recommendations/results-cache";
import type { Recommendation, RecommendationRequest } from "@/types/recommendation";

const storage = installMemorySessionStorage();
const RESULTS_KEY = "gamenight_recommendation_results";

const personal: RecommendationRequest = { mode: "personal", player_count: 3, max_playtime: 60 };

function recommendation(id: number, score: number): Recommendation {
  return {
    game: {
      id,
      name: `Game ${id}`,
      description: null,
      minimum_players: 2,
      maximum_players: 4,
      playtime: 45,
      difficulty: "Easy",
      categories: ["Family"],
      image_url: null,
      rating: null,
      review_count: null,
      instructions: null,
    },
    score,
    reason: "Fits your group",
    owners: [{ id: 1, name: "Alex", bio: null, avatar_url: null }],
  };
}

/** Backend order: tied scores keep the backend's order, never re-sorted. */
const results = [recommendation(5, 91.5), recommendation(2, 91.5), recommendation(9, 40)];

/** Submits a request and returns its snapshot, like pressing "Get Recommendations". */
function submit(
  request: RecommendationRequest = personal,
  at = "2026-11-25T10:00:00Z",
  userId = 1,
): SubmittedRequestSnapshot {
  saveSubmittedRequest(userId, request, new Date(at));
  const loaded = loadSubmittedRequest(userId);
  if (loaded.status !== "ok") throw new Error("expected a saved snapshot");
  return loaded.snapshot;
}

beforeEach(() => storage.reset());

describe("results cache", () => {
  test("a refresh of the same submission reuses the cached results in backend order", () => {
    const snapshot = submit();
    saveCachedResults(snapshot, results);
    expect(loadCachedResults(snapshot)?.map((r) => r.game.id)).toEqual([5, 2, 9]);
  });

  test("an empty result list is cached too (a valid result, not an error)", () => {
    const snapshot = submit();
    saveCachedResults(snapshot, []);
    expect(loadCachedResults(snapshot)).toEqual([]);
  });

  test("a new submission with identical answers does not reuse old results", () => {
    saveCachedResults(submit(personal, "2026-11-25T10:00:00Z"), results);
    const resubmitted = submit(personal, "2026-11-25T10:05:00Z");

    expect(loadCachedResults(resubmitted)).toBeNull();
    expect(storage.store.has(RESULTS_KEY)).toBe(false);
  });

  test("changed answers never show stale results", () => {
    const snapshot = submit();
    saveCachedResults(snapshot, results);
    expect(loadCachedResults({ ...snapshot, request: { ...personal, max_playtime: 30 } })).toBeNull();
  });

  test("switching mode never shows stale results", () => {
    const snapshot = submit();
    saveCachedResults(snapshot, results);
    const gameNight: RecommendationRequest = { mode: "game_night", game_night_id: 3, max_playtime: 60 };
    expect(loadCachedResults({ ...snapshot, request: gameNight })).toBeNull();
  });

  test("another user's cached results are not shown", () => {
    const snapshot = submit();
    saveCachedResults(snapshot, results);
    expect(loadCachedResults({ ...snapshot, userId: 2 })).toBeNull();
  });

  test("corrupt or tampered cache data is rejected and removed", () => {
    const snapshot = submit();
    storage.store.set(RESULTS_KEY, "{oops");
    expect(loadCachedResults(snapshot)).toBeNull();
    expect(storage.store.has(RESULTS_KEY)).toBe(false);

    saveCachedResults(snapshot, results);
    const raw = JSON.parse(storage.store.get(RESULTS_KEY)!);
    raw.recommendations[0].score = "100";
    storage.store.set(RESULTS_KEY, JSON.stringify(raw));
    expect(loadCachedResults(snapshot)).toBeNull();
  });

  test("results are stored separately from the request and hold no token", () => {
    saveCachedResults(submit(), results);
    expect([...storage.store.keys()].sort()).toEqual([
      RESULTS_KEY,
      "gamenight_submitted_recommendation_request",
    ]);
    expect(storage.store.get(RESULTS_KEY)).not.toMatch(/token|bearer|password|email/i);
  });
});

describe("parseRecommendationList (API responses and cached data)", () => {
  test("keeps the backend's order exactly", () => {
    expect(parseRecommendationList({ recommendations: results })?.map((r) => r.game.id)).toEqual([5, 2, 9]);
  });

  test("drops unknown fields such as an owner email", () => {
    const withEmail = { ...results[0], owners: [{ id: 1, name: "A", email: "a@example.com", bio: null, avatar_url: null }] };
    expect(parseRecommendationList({ recommendations: [withEmail] })?.[0].owners[0]).toEqual({
      id: 1,
      name: "A",
      bio: null,
      avatar_url: null,
    });
  });

  test.each([
    ["an HTML page", "<html>"],
    ["a body without an array", {}],
    ["a string score", { recommendations: [{ ...results[0], score: "90" }] }],
    ["a missing reason", { recommendations: [{ ...results[0], reason: null }] }],
    ["an incomplete game", { recommendations: [{ ...results[0], game: { id: 1 } }] }],
  ])("rejects %s", (_name, body) => {
    expect(parseRecommendationList(body)).toBeNull();
  });
});

describe("Start Over and Edit answers", () => {
  test("Start Over clears the draft, the submitted request and the cached results", () => {
    saveCachedResults(submit(), results);
    saveDraft(1, { step: 2, answers: answersFromRequest(personal) });

    startOver();
    expect(storage.store.size).toBe(0);
  });

  test("Edit answers rebuilds a missing draft on the review step", () => {
    prepareDraftForEditing(1, personal);
    const draft = loadDraft(1);
    expect(draft.step).toBe(3);
    expect(draft.answers).toMatchObject({ mode: "personal", playerCount: "3", maxPlaytime: "60" });
  });

  test("Edit answers keeps a newer unsubmitted draft", () => {
    saveDraft(1, { step: 1, answers: { ...INITIAL_ANSWERS, mode: "personal", playerCount: "5", maxPlaytime: "30" } });
    prepareDraftForEditing(1, personal);
    expect(loadDraft(1)).toMatchObject({ step: 1, answers: { playerCount: "5" } });
  });

  test("detects when the draft was edited after submitting", () => {
    expect(draftDiffersFromRequest(1, personal)).toBe(false); // no draft yet
    saveDraft(1, { step: 3, answers: answersFromRequest(personal) });
    expect(draftDiffersFromRequest(1, personal)).toBe(false);
    saveDraft(1, { step: 1, answers: { ...answersFromRequest(personal), maxPlaytime: "30" } });
    expect(draftDiffersFromRequest(1, personal)).toBe(true);
  });
});
