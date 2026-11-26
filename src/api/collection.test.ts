/// <reference types="bun" />
// Regression tests for the collection API helpers. The shared Axios instance is stubbed,
// so no request reaches the backend or its database.
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import api from "@/api/client";
import {
  addToCollection,
  getCollection,
  removeFromCollection,
  updateCollectionStatus,
} from "@/api/collection";
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

const entries: CollectionGame[] = [
  { game: game(1), status: "owned" },
  { game: game(2), status: "wishlist" },
];

function stubGet(data: unknown = { games: entries }) {
  return spyOn(api, "get").mockResolvedValue({ data } as never);
}

const spies: { mockRestore(): void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

describe("getCollection(userId, status?, signal?)", () => {
  test('the homepage call getCollection(userId, "owned", signal) filters on the server and forwards the signal', async () => {
    const get = stubGet();
    spies.push(get);
    const signal = new AbortController().signal;

    const result = await getCollection(7, "owned", signal);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/users/7/collection", { params: { status: "owned" }, signal });
    expect(result).toEqual(entries);
  });

  test('"wishlist" is forwarded as ?status=wishlist', async () => {
    const get = stubGet();
    spies.push(get);

    await getCollection(7, "wishlist");

    expect(get).toHaveBeenCalledWith("/users/7/collection", { params: { status: "wishlist" }, signal: undefined });
  });

  test("without a status both owned and wishlist games are requested (the Collection page)", async () => {
    const get = stubGet();
    spies.push(get);

    const result = await getCollection(7);

    expect(get).toHaveBeenCalledWith("/users/7/collection", { params: undefined, signal: undefined });
    expect(result.map((entry) => entry.status)).toEqual(["owned", "wishlist"]);
  });

  test("a signal without a status is still forwarded", async () => {
    const get = stubGet();
    spies.push(get);
    const signal = new AbortController().signal;

    await getCollection(7, undefined, signal);

    expect(get).toHaveBeenCalledWith("/users/7/collection", { params: undefined, signal });
  });

  test("an unexpected response shape is an error, not an empty collection", async () => {
    spies.push(stubGet({ detail: "nope" }));
    await expect(getCollection(7, "owned")).rejects.toThrow("Unexpected response format");
  });
});

describe("collection mutations", () => {
  test("addToCollection POSTs game_id and status", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { game_id: 3, status: "owned" } } as never);
    spies.push(post);

    await addToCollection(7, 3, "owned");

    expect(post).toHaveBeenCalledWith("/users/7/collection", { game_id: 3, status: "owned" });
  });

  test("updateCollectionStatus uses the atomic PUT endpoint", async () => {
    const put = spyOn(api, "put").mockResolvedValue({ data: { game_id: 3, status: "wishlist" } } as never);
    spies.push(put);

    await updateCollectionStatus(7, 3, "wishlist");

    expect(put).toHaveBeenCalledWith("/users/7/collection/3", { status: "wishlist" });
  });

  test("removeFromCollection DELETEs the entry", async () => {
    const del = spyOn(api, "delete").mockResolvedValue({ data: undefined } as never);
    spies.push(del);

    await removeFromCollection(7, 3);

    expect(del).toHaveBeenCalledWith("/users/7/collection/3");
  });
});
