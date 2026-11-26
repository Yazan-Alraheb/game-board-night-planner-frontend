/// <reference types="bun" />
// Collection page: local edits never leak across loads (users, sessions, retries).
import { describe, expect, test } from "bun:test";
import { userRequestKey, resolveUserResource } from "@/lib/user-resource";
import {
  editCollection,
  entriesForTab,
  NO_EDITS,
  removalCopy,
  visibleCollection,
  withoutGame,
  withStatus,
} from "@/lib/games/collection-page";
import type { CollectionGame } from "@/types/collection";
import type { Game } from "@/types/game";

const game = (id: number): Game => ({
  id,
  name: `Game ${id}`,
  description: null,
  minimum_players: 2,
  maximum_players: 4,
  playtime: 30,
  difficulty: "Easy",
  categories: [],
  image_url: null,
  rating: null,
  review_count: null,
  instructions: null,
});

const entry = (id: number, status: CollectionGame["status"]): CollectionGame => ({ game: game(id), status });

describe("visibleCollection", () => {
  test("nothing is shown before the collection loads (no previous data)", () => {
    expect(visibleCollection(null, NO_EDITS)).toEqual([]);
  });

  test("shows the loaded collection, then the local edits made on it", () => {
    const loaded = [entry(1, "owned"), entry(2, "wishlist")];
    expect(visibleCollection(loaded, NO_EDITS)).toBe(loaded);

    const edits = editCollection(NO_EDITS, loaded, withStatus(2, "owned"));
    expect(visibleCollection(loaded, edits).map((e) => e.status)).toEqual(["owned", "owned"]);
  });

  test("edits made on another user's (or an older) load are never shown on a new load", () => {
    const userA = [entry(1, "owned"), entry(2, "owned")];
    const editsOnA = editCollection(NO_EDITS, userA, withoutGame(1));

    const userB = [entry(9, "wishlist")];
    expect(visibleCollection(userB, editsOnA)).toBe(userB);
  });

  test("a late action result for an obsolete load doesn't overwrite the current collection", () => {
    const first = [entry(1, "owned")];
    const reloaded = [entry(1, "owned"), entry(3, "owned")];

    // A PUT started on `first` finishes after the collection was loaded again.
    const late = editCollection(NO_EDITS, first, withStatus(1, "wishlist"));

    expect(visibleCollection(reloaded, late)).toBe(reloaded);
  });

  test("several edits on the same load accumulate", () => {
    const loaded = [entry(1, "owned"), entry(2, "owned"), entry(3, "wishlist")];
    let edits = editCollection(NO_EDITS, loaded, withoutGame(2));
    edits = editCollection(edits, loaded, withStatus(3, "owned"));

    expect(visibleCollection(loaded, edits).map((e) => [e.game.id, e.status])).toEqual([
      [1, "owned"],
      [3, "owned"],
    ]);
    expect(loaded).toHaveLength(3); // the loaded data itself is never mutated
  });
});

describe("tabs", () => {
  test("owned and wishlist entries are split by status", () => {
    const entries = [entry(1, "owned"), entry(2, "wishlist"), entry(3, "owned")];
    expect(entriesForTab(entries, "owned").map((e) => e.game.id)).toEqual([1, 3]);
    expect(entriesForTab(entries, "wishlist").map((e) => e.game.id)).toEqual([2]);
  });
});

describe("removal confirmation copy", () => {
  test("names the game and the list it is removed from", () => {
    expect(removalCopy(entry(4, "owned"))).toEqual({
      title: "Remove Game 4?",
      description: "Game 4 will be removed from your owned games. You can add it again from its game page.",
    });
    expect(removalCopy(entry(4, "wishlist")).description).toContain("your wishlist");
  });
});

describe("loading through useUserResource", () => {
  test("a response for the previous user or session is not used for the current one", () => {
    const oldKey = userRequestKey(1, "token-a", 0)!;
    const newKey = userRequestKey(2, "token-b", 0)!;
    const stale = { key: oldKey, value: { status: "success" as const, data: [entry(1, "owned")] } };

    expect(resolveUserResource(true, newKey, stale)).toEqual({ status: "loading" });
  });

  test("Retry starts a new request key, so the old error isn't shown again", () => {
    const failed = { key: userRequestKey(1, "t", 0)!, value: { status: "error" as const, error: { kind: "server" as const, status: 500, detail: null } } };
    expect(resolveUserResource(true, userRequestKey(1, "t", 1), failed)).toEqual({ status: "loading" });
  });
});
