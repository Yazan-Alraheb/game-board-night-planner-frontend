/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import {
  INITIAL_ANSWERS,
  INITIAL_STATE,
  buildRecommendationRequest,
  questionnaireReducer,
  validateStep,
  type QuestionnaireAnswers,
} from "@/lib/find-game/questionnaire";

/** Valid shared answers; each test sets the mode-specific fields. */
const base: QuestionnaireAnswers = { ...INITIAL_ANSWERS, maxPlaytime: "60" };

describe("buildRecommendationRequest: request validation", () => {
  test("personal mode builds the exact backend shape and omits empty optional fields", () => {
    expect(buildRecommendationRequest({ ...base, mode: "personal", playerCount: "3" })).toEqual({
      ok: true,
      request: { mode: "personal", player_count: 3, max_playtime: 60 },
    });
  });

  test("game-night mode sends game_night_id and no player_count", () => {
    expect(buildRecommendationRequest({ ...base, mode: "game_night", gameNightId: 12 })).toEqual({
      ok: true,
      request: { mode: "game_night", game_night_id: 12, max_playtime: 60 },
    });
  });

  test("switching modes never sends the other mode's stale field", () => {
    const personal = buildRecommendationRequest({ ...base, mode: "personal", playerCount: "4", gameNightId: 99 });
    const gameNight = buildRecommendationRequest({ ...base, mode: "game_night", playerCount: "4", gameNightId: 99 });

    expect(personal.ok && "game_night_id" in personal.request).toBe(false);
    expect(gameNight.ok && "player_count" in gameNight.request).toBe(false);
  });

  test("optional fields are included when chosen and never sent as null", () => {
    const result = buildRecommendationRequest({
      ...base,
      mode: "personal",
      playerCount: "2",
      categories: ["Strategy", " strategy ", "Family"],
      experienceLevel: "Beginner",
    });

    expect(result).toEqual({
      ok: true,
      request: {
        mode: "personal",
        player_count: 2,
        max_playtime: 60,
        categories: ["Strategy", "Family"], // trimmed and de-duplicated case-insensitively
        experience_level: "Beginner",
      },
    });
    expect(JSON.stringify(result)).not.toContain("null");
  });

  test("a missing mode fails on step 0", () => {
    expect(buildRecommendationRequest(INITIAL_ANSWERS)).toMatchObject({ ok: false, step: 0 });
  });

  test("a game night must be chosen in game-night mode", () => {
    expect(buildRecommendationRequest({ ...base, mode: "game_night" })).toMatchObject({
      ok: false,
      step: 0,
      errors: { gameNightId: expect.any(String) },
    });
  });

  test.each(["", "0", "-1", "2.5", "3e", "abc", "101"])("rejects player count %p", (playerCount) => {
    expect(validateStep(0, { ...base, mode: "personal", playerCount }).playerCount).toBeDefined();
  });

  test.each(["", "0", "1441", "1.5"])("rejects max playtime %p", (maxPlaytime) => {
    expect(
      buildRecommendationRequest({ ...base, mode: "personal", playerCount: "2", maxPlaytime }),
    ).toMatchObject({ ok: false, step: 1 });
  });

  test("accepts surrounding whitespace in numbers", () => {
    expect(validateStep(1, { ...base, maxPlaytime: " 45 " })).toEqual({});
  });
});

describe("questionnaireReducer", () => {
  test("toggles categories on and off", () => {
    const on = questionnaireReducer(INITIAL_STATE, { type: "toggleCategory", category: "Party" });
    expect(on.answers.categories).toEqual(["Party"]);
    const off = questionnaireReducer(on, { type: "toggleCategory", category: "Party" });
    expect(off.answers.categories).toEqual([]);
  });

  test("reset returns to the initial state", () => {
    const changed = questionnaireReducer({ ...INITIAL_STATE, step: 3 }, { type: "setMode", mode: "personal" });
    expect(questionnaireReducer(changed, { type: "reset" })).toEqual(INITIAL_STATE);
  });
});
