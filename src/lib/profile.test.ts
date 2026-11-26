/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  PLAYTIME_OPTIONS,
  DEFAULT_PREFERENCES,
  toggleCategory,
  getPlaytimeOption,
  getProfileCategories,
  formatMemberSince,
} from "@/lib/profile";

describe("Favorite categories", () => {
  test("adds a category", () => {
    expect(toggleCategory(["Strategy"], "Party"))
      .toEqual(["Strategy", "Party"]);
  });

  test("removes a selected category", () => {
    expect(toggleCategory(["Strategy", "Party"], "Strategy"))
      .toEqual(["Party"]);
  });

  test("selects a category when none are selected", () => {
    expect(toggleCategory([], "Family"))
      .toEqual(["Family"]);
  });

  test("does not modify the original array", () => {
    const original = ["Strategy"];

    toggleCategory(original, "Party");

    expect(original).toEqual(["Strategy"]);
  });

  test("preserves existing custom categories", () => {
    expect(toggleCategory(["Adventure"], "Party"))
      .toEqual(["Adventure", "Party"]);
  });

    test("uses categories from the game catalog", () => {
    expect(
        getProfileCategories(["Family", "Strategy"], [])
    ).toEqual(["Family", "Strategy"]);
    });

    test("preserves previously saved categories", () => {
    expect(
        getProfileCategories(
        ["Family", "Strategy"],
        ["Adventure"]
        )
    ).toEqual(["Family", "Strategy", "Adventure"]);
    });

    test("does not duplicate categories", () => {
    expect(
        getProfileCategories(
        ["Family", "Strategy"],
        ["Strategy"]
        )
    ).toEqual(["Family", "Strategy"]);
    });

    test("preserves selections when the catalog is unavailable", () => {
    expect(
        getProfileCategories([], ["Strategy"])
    ).toEqual(["Strategy"]);
    });

    test("handles an empty catalog and no selections", () => {
    expect(getProfileCategories([], [])).toEqual([]);
    });

});

describe("Preferred playtime", () => {
  test.each([1, 15, 25, 29])(
    "maps %p minutes to Quick",
    (minutes) => {
      expect(getPlaytimeOption(minutes)).toBe(29);
    }
  );

  test.each([30, 45, 60, 90])(
    "maps %p minutes to Medium",
    (minutes) => {
      expect(getPlaytimeOption(minutes)).toBe(90);
    }
  );

  test.each([91, 120, 180])(
    "maps %p minutes to Long",
    (minutes) => {
      expect(getPlaytimeOption(minutes)).toBe(180);
    }
  );

  test("handles no preferred playtime", () => {
    expect(getPlaytimeOption(null)).toBeNull();
  });

  test("preserves custom longer playtime preferences", () => {
    expect(getPlaytimeOption(240)).toBe(240);
  });

  test("playtime options match their upper limits", () => {
    expect(
      PLAYTIME_OPTIONS.map((option) => option.value)
    ).toEqual([29, 90, 180]);
  });
});

describe("Membership date", () => {
  test("formats the membership month and year", () => {
    expect(formatMemberSince("2026-09-15T12:00:00Z"))
      .toBe("Sep 2026");
  });

  test("formats a different membership year", () => {
    expect(formatMemberSince("2025-06-15T12:00:00Z"))
      .toBe("Jun 2025");
  });

  test("handles invalid dates", () => {
    expect(formatMemberSince("invalid-date")).toBe("");
  });

  test("handles empty dates", () => {
    expect(formatMemberSince("")).toBe("");
  });
});

describe("Default preferences", () => {
  test("new users have no selected categories", () => {
    expect(DEFAULT_PREFERENCES.favorite_categories)
      .toEqual([]);
  });

  test("new users have no disliked categories", () => {
    expect(DEFAULT_PREFERENCES.disliked_categories)
      .toEqual([]);
  });

  test("new users have no preferred difficulty", () => {
    expect(DEFAULT_PREFERENCES.preferred_difficulty)
      .toBeNull();
  });

  test("new users have no preferred playtime", () => {
    expect(DEFAULT_PREFERENCES.preferred_playtime)
      .toBeNull();
  });
});
