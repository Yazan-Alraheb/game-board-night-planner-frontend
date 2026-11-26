/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import { AxiosError, CanceledError } from "axios";
import {
  GameCollectionStatus,
  actionFor,
  collectionStatusScope,
  findSavedStatus,
  readCollectionStatus,
  type CollectionApi,
} from "@/lib/games/collection-status";
import type { CollectionGame, CollectionStatus } from "@/types/collection";
import type { Game } from "@/types/game";

function httpError(status: number): AxiosError {
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: {},
  });
}

const networkError = new AxiosError("Network Error", "ERR_NETWORK");

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

const entry = (id: number, status: CollectionStatus): CollectionGame => ({ game: game(id), status });

interface Pending {
  method: "get" | "post" | "put" | "delete";
  args: unknown[];
  resolve: (value?: unknown) => Promise<void>;
  reject: (error: unknown) => Promise<void>;
}

/** A fake collection API: every call waits until the test settles it. Nothing touches the backend. */
function fakeApi() {
  const calls: Pending[] = [];
  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  const record =
    (method: Pending["method"]) =>
    (...args: unknown[]) =>
      new Promise<never>((resolve, reject) => {
        calls.push({
          method,
          args,
          resolve: (value) => {
            resolve(value as never);
            return settle();
          },
          reject: (error) => {
            reject(error);
            return settle();
          },
        });
      });

  const api: CollectionApi = {
    getCollection: record("get"),
    addToCollection: record("post"),
    updateCollectionStatus: record("put"),
    removeFromCollection: record("delete"),
  };
  const count = (method: Pending["method"]) => calls.filter((call) => call.method === method).length;
  return { api, calls, count, last: () => calls[calls.length - 1] };
}

const USER = 7;
const GAME = 3;
const SCOPE = collectionStatusScope(USER, GAME)!;

async function openWith(entries: CollectionGame[]) {
  const fake = fakeApi();
  const store = new GameCollectionStatus(fake.api);
  store.open(SCOPE, USER, GAME);
  await fake.last().resolve(entries);
  return { ...fake, store, state: () => readCollectionStatus(store.getSnapshot(), SCOPE) };
}

describe("helpers", () => {
  test("findSavedStatus finds the displayed game only", () => {
    const entries = [entry(1, "owned"), entry(3, "wishlist")];
    expect(findSavedStatus(entries, 3)).toBe("wishlist");
    expect(findSavedStatus(entries, 1)).toBe("owned");
    expect(findSavedStatus(entries, 9)).toBeNull();
  });

  test("actionFor never adds a game that is already saved", () => {
    expect(actionFor(null, "owned")).toBe("add-owned");
    expect(actionFor(null, "wishlist")).toBe("add-wishlist");
    expect(actionFor("owned", "wishlist")).toBe("move-wishlist");
    expect(actionFor("wishlist", "owned")).toBe("move-owned");
    expect(actionFor("owned", "owned")).toBeNull();
  });

  test("scope needs both user and game", () => {
    expect(collectionStatusScope(null, 3)).toBeNull();
    expect(collectionStatusScope(7, null)).toBeNull();
    expect(collectionStatusScope(7, 3)).toBe("7:3");
  });
});

describe("loading the saved status", () => {
  test("requests the whole collection (both statuses) with an abort signal", async () => {
    const fake = fakeApi();
    const store = new GameCollectionStatus(fake.api);
    store.open(SCOPE, USER, GAME);

    expect(readCollectionStatus(store.getSnapshot(), SCOPE)).toEqual({ status: "loading" });
    expect(fake.calls[0].method).toBe("get");
    expect(fake.calls[0].args[0]).toBe(USER);
    expect(fake.calls[0].args[1]).toBeUndefined();
    expect(fake.calls[0].args[2]).toBeInstanceOf(AbortSignal);
  });

  test("a game already owned shows as owned", async () => {
    const { state } = await openWith([entry(GAME, "owned"), entry(9, "wishlist")]);
    expect(state()).toEqual({ status: "ready", saved: "owned", pending: null, notice: null });
  });

  test("a game already on the wishlist shows as wishlist", async () => {
    const { state } = await openWith([entry(GAME, "wishlist")]);
    expect(state()).toMatchObject({ status: "ready", saved: "wishlist" });
  });

  test("an unsaved game shows as not saved", async () => {
    const { state } = await openWith([entry(9, "owned")]);
    expect(state()).toMatchObject({ status: "ready", saved: null });
  });

  test("a failed lookup is an error, never a guessed status; retry loads again", async () => {
    const fake = fakeApi();
    const store = new GameCollectionStatus(fake.api);
    store.open(SCOPE, USER, GAME);
    await fake.last().reject(httpError(500));

    const state = readCollectionStatus(store.getSnapshot(), SCOPE);
    expect(state).toMatchObject({ status: "error", error: { kind: "server" } });

    const retry = store.retry();
    expect(readCollectionStatus(store.getSnapshot(), SCOPE)).toEqual({ status: "loading" });
    await fake.last().resolve([entry(GAME, "owned")]);
    await retry;
    expect(readCollectionStatus(store.getSnapshot(), SCOPE)).toMatchObject({ saved: "owned" });
    expect(fake.count("get")).toBe(2);
  });

  test("retry does nothing while the lookup is still running (no duplicate GET)", async () => {
    const fake = fakeApi();
    const store = new GameCollectionStatus(fake.api);
    store.open(SCOPE, USER, GAME);
    await store.retry();
    expect(fake.count("get")).toBe(1);
  });
});

describe("saving", () => {
  test("adding an unsaved game POSTs once and shows it as owned", async () => {
    const { store, state, count, last } = await openWith([]);

    const done = store.save("owned");
    expect(state()).toMatchObject({ saved: null, pending: "add-owned" });
    expect(last().method).toBe("post");
    expect(last().args).toEqual([USER, GAME, "owned"]);

    await last().resolve({ game_id: GAME, status: "owned" });
    await done;
    expect(state()).toEqual({
      status: "ready",
      saved: "owned",
      pending: null,
      notice: { tone: "success", text: "Added to your collection." },
    });
    expect(count("post")).toBe(1);
  });

  test("adding to the wishlist POSTs with status wishlist", async () => {
    const { store, state, last } = await openWith([]);
    void store.save("wishlist");
    expect(last().args).toEqual([USER, GAME, "wishlist"]);
    await last().resolve();
    expect(state()).toMatchObject({ saved: "wishlist" });
  });

  test("switching owned -> wishlist uses PUT, never a duplicate POST", async () => {
    const { store, state, count, last } = await openWith([entry(GAME, "owned")]);

    void store.save("wishlist");
    expect(last().method).toBe("put");
    expect(last().args).toEqual([USER, GAME, "wishlist"]);
    await last().resolve();

    expect(state()).toMatchObject({ saved: "wishlist", notice: { text: "Moved to your wishlist." } });
    expect(count("post")).toBe(0);
  });

  test("switching wishlist -> owned uses PUT", async () => {
    const { store, state, count, last } = await openWith([entry(GAME, "wishlist")]);
    void store.save("owned");
    expect(last().method).toBe("put");
    await last().resolve();
    expect(state()).toMatchObject({ saved: "owned" });
    expect(count("post")).toBe(0);
  });

  test("saving the status it already has makes no request", async () => {
    const { store, calls } = await openWith([entry(GAME, "owned")]);
    await store.save("owned");
    expect(calls).toHaveLength(1);
  });

  test("clicks while an action is pending are ignored", async () => {
    const { store, count, last } = await openWith([]);
    void store.save("owned");
    void store.save("owned");
    void store.save("wishlist");
    void store.remove();
    expect(count("post")).toBe(1);
    expect(count("put")).toBe(0);
    expect(count("delete")).toBe(0);
    await last().resolve();
  });

  test("a failed save keeps the previous status and shows an error", async () => {
    const { store, state, last } = await openWith([entry(GAME, "owned")]);
    void store.save("wishlist");
    await last().reject(networkError);

    expect(state()).toEqual({
      status: "ready",
      saved: "owned",
      pending: null,
      notice: { tone: "error", text: "Could not move this game to your wishlist. Please try again." },
    });
  });

  test("a 409 on add (saved elsewhere) refetches and shows the real status", async () => {
    const { store, state, count, last } = await openWith([]);
    void store.save("owned");
    await last().reject(httpError(409));

    expect(state()).toMatchObject({ saved: null, pending: "refresh" });
    expect(last().method).toBe("get");
    await last().resolve([entry(GAME, "wishlist")]);

    expect(state()).toMatchObject({ saved: "wishlist", pending: null, notice: { tone: "error" } });
    expect(count("post")).toBe(1);
  });

  test("a 404 on switch (removed elsewhere) refetches instead of guessing", async () => {
    const { store, state, last } = await openWith([entry(GAME, "owned")]);
    void store.save("wishlist");
    await last().reject(httpError(404));
    await last().resolve([]);
    expect(state()).toMatchObject({ saved: null, pending: null });
  });

  test("if that refetch fails too, the error state is shown, not a saved status", async () => {
    const { store, state, last } = await openWith([]);
    void store.save("owned");
    await last().reject(httpError(409));
    await last().reject(networkError);
    expect(state()).toMatchObject({ status: "error", error: { kind: "network" } });
  });
});

describe("removing", () => {
  test("remove DELETEs and shows the game as not saved", async () => {
    const { store, state, last } = await openWith([entry(GAME, "wishlist")]);
    void store.remove();
    expect(state()).toMatchObject({ saved: "wishlist", pending: "remove" });
    expect(last().method).toBe("delete");
    expect(last().args).toEqual([USER, GAME]);
    await last().resolve();
    expect(state()).toMatchObject({ saved: null, notice: { text: "Removed from your collection." } });
  });

  test("remove on an unsaved game makes no request", async () => {
    const { store, calls } = await openWith([]);
    await store.remove();
    expect(calls).toHaveLength(1);
  });

  test("a failed remove keeps the game shown as saved", async () => {
    const { store, state, last } = await openWith([entry(GAME, "owned")]);
    void store.remove();
    await last().reject(httpError(500));
    expect(state()).toMatchObject({ saved: "owned", notice: { tone: "error" } });
  });
});

describe("scopes", () => {
  test("navigating to another game aborts the old lookup and never shows its result", async () => {
    const fake = fakeApi();
    const store = new GameCollectionStatus(fake.api);
    store.open(SCOPE, USER, GAME);
    const first = fake.calls[0];

    const other = collectionStatusScope(USER, 4)!;
    store.open(other, USER, 4);
    expect((first.args[2] as AbortSignal).aborted).toBe(true);

    await first.resolve([entry(GAME, "owned"), entry(4, "wishlist")]);
    expect(readCollectionStatus(store.getSnapshot(), other)).toEqual({ status: "loading" });

    await fake.last().resolve([entry(4, "wishlist")]);
    expect(readCollectionStatus(store.getSnapshot(), other)).toMatchObject({ saved: "wishlist" });
    // The previous game's scope reads as loading, never as game 4's status.
    expect(readCollectionStatus(store.getSnapshot(), SCOPE)).toEqual({ status: "loading" });
  });

  test("a save that finishes after navigating away is ignored", async () => {
    const { store, last } = await openWith([]);
    void store.save("owned");
    const post = last();

    const other = collectionStatusScope(USER, 4)!;
    store.open(other, USER, 4);
    await last().resolve([]); // Game 4 isn't saved.

    await post.resolve(); // Game 3's POST finishing late must not mark game 4 as owned.
    expect(readCollectionStatus(store.getSnapshot(), other)).toMatchObject({ saved: null, notice: null });
  });

  test("a canceled lookup doesn't show an error", async () => {
    const fake = fakeApi();
    const store = new GameCollectionStatus(fake.api);
    store.open(SCOPE, USER, GAME);
    await fake.last().reject(new CanceledError());
    expect(readCollectionStatus(store.getSnapshot(), SCOPE)).toEqual({ status: "loading" });
  });

  test("after close nothing is shown and late responses can't write", async () => {
    const fake = fakeApi();
    const store = new GameCollectionStatus(fake.api);
    store.open(SCOPE, USER, GAME);
    store.close();
    expect((fake.last().args[2] as AbortSignal).aborted).toBe(true);
    await fake.last().resolve([entry(GAME, "owned")]);
    expect(store.getSnapshot().value).toEqual({ status: "loading" });
    expect(readCollectionStatus(store.getSnapshot(), null)).toEqual({ status: "loading" });
  });
});
