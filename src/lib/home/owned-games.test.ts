/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import { isGameOwned, ownedGameIdsFrom } from "@/lib/home/owned-games";
import type { CollectionGame, CollectionStatus } from "@/types/collection";

function entry(gameId: number, status: CollectionStatus): CollectionGame {
  return {
    status,
    game: {
      id: gameId,
      name: `Game ${gameId}`,
      description: null,
      minimum_players: 2,
      maximum_players: 4,
      playtime: 60,
      difficulty: "easy",
      categories: [],
      image_url: null,
      rating: null,
      review_count: null,
      instructions: null,
    },
  };
}

describe("ownedGameIdsFrom", () => {
  test("includes games with status owned", () => {
    expect([...ownedGameIdsFrom([entry(1, "owned"), entry(2, "owned")])]).toEqual([1, 2]);
  });

  test("never treats wishlist games as owned, even if the server returns them", () => {
    const owned = ownedGameIdsFrom([entry(1, "owned"), entry(2, "wishlist")]);
    expect(owned.has(1)).toBe(true);
    expect(owned.has(2)).toBe(false);
  });

  test("handles an empty collection", () => {
    expect(ownedGameIdsFrom([]).size).toBe(0);
  });
});

describe("isGameOwned", () => {
  test("is true only for ids in the owned set", () => {
    const owned = ownedGameIdsFrom([entry(1, "owned"), entry(2, "wishlist")]);
    expect(isGameOwned(owned, 1)).toBe(true);
    expect(isGameOwned(owned, 2)).toBe(false);
    expect(isGameOwned(owned, 3)).toBe(false);
  });

  test("missing ownership data (signed out, loading or failed) marks nothing as owned", () => {
    expect(isGameOwned(null, 1)).toBe(false);
  });

  test("an empty collection marks nothing as owned", () => {
    expect(isGameOwned(new Set(), 1)).toBe(false);
  });
});
