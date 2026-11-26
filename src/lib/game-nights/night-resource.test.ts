/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import { AxiosError, CanceledError } from "axios";
import {
  NightResource,
  nightResourceScope,
  readNightResource,
  type Resource,
} from "@/lib/game-nights/night-resource";

/** A fake API: every call waits until the test resolves or rejects it, in any order. */
function controllableFetcher<T>() {
  const calls: {
    nightId: number;
    signal: AbortSignal;
    resolve: (data: T) => Promise<void>;
    reject: (error: unknown) => Promise<void>;
  }[] = [];

  const fetcher = (nightId: number, signal: AbortSignal) =>
    new Promise<T>((resolve, reject) => {
      // Returning a settled tick lets the resource's await/finally run before assertions.
      const settle = async () => {
        await Promise.resolve();
        await Promise.resolve();
      };
      calls.push({
        nightId,
        signal,
        resolve: (data) => {
          resolve(data);
          return settle();
        },
        reject: (error) => {
          reject(error);
          return settle();
        },
      });
    });

  return { fetcher, calls };
}

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

interface Game {
  id: number;
  selected: boolean;
}

const USER_A_NIGHT_5 = nightResourceScope(1, 5)!;
const USER_B_NIGHT_5 = nightResourceScope(2, 5)!;
const USER_A_NIGHT_6 = nightResourceScope(1, 6)!;

function setup() {
  const { fetcher, calls } = controllableFetcher<Game[]>();
  const resource = new NightResource(fetcher);
  const read = (scope: string | null): Resource<Game[]> => readNightResource(resource.getSnapshot(), scope);
  return { resource, calls, read };
}

const success = (data: Game[]): Resource<Game[]> => ({ status: "success", data });

describe("nightResourceScope", () => {
  test("needs both a signed-in user and a night", () => {
    expect(nightResourceScope(null, 5)).toBeNull();
    expect(nightResourceScope(1, null)).toBeNull();
    expect(nightResourceScope(1, 5)).toBe("1:5");
  });

  test("differs per user and per night", () => {
    expect(USER_A_NIGHT_5).not.toBe(USER_B_NIGHT_5);
    expect(USER_A_NIGHT_5).not.toBe(USER_A_NIGHT_6);
  });
});

describe("NightResource scoping (user + night)", () => {
  test("user A's loaded data never shows for user B", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    await calls[0].resolve([{ id: 1, selected: true }]);
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 1, selected: true }]));

    // Session changes to user B without the page unmounting.
    resource.close();
    resource.open(USER_B_NIGHT_5, 5);
    expect(read(USER_B_NIGHT_5)).toEqual({ status: "loading" });

    await calls[1].resolve([{ id: 2, selected: false }]);
    expect(read(USER_B_NIGHT_5)).toEqual(success([{ id: 2, selected: false }]));
    expect(read(USER_A_NIGHT_5)).toEqual({ status: "loading" });
  });

  test("a response started for user A is ignored after switching to user B", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    resource.close();
    resource.open(USER_B_NIGHT_5, 5);

    expect(calls[0].signal.aborted).toBe(true);
    await calls[0].resolve([{ id: 99, selected: true }]); // A's slow response arrives late.
    expect(read(USER_B_NIGHT_5)).toEqual({ status: "loading" });
    expect(resource.getSnapshot().scope).toBeNull();

    await calls[1].resolve([{ id: 2, selected: false }]);
    expect(read(USER_B_NIGHT_5)).toEqual(success([{ id: 2, selected: false }]));
  });

  test("a response for a previous night id is ignored", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    resource.open(USER_A_NIGHT_6, 6);
    expect(calls.map((call) => call.nightId)).toEqual([5, 6]);

    await calls[1].resolve([{ id: 6, selected: false }]);
    await calls[0].resolve([{ id: 5, selected: false }]); // Night 5 answers last.
    expect(read(USER_A_NIGHT_6)).toEqual(success([{ id: 6, selected: false }]));
  });

  test("calls from a previous scope (stale callbacks) are no-ops", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    await calls[0].resolve([{ id: 1, selected: false }]);
    resource.close();
    resource.open(USER_B_NIGHT_5, 5);
    await calls[1].resolve([{ id: 2, selected: false }]);

    resource.update(USER_A_NIGHT_5, () => [{ id: 1, selected: true }], "always");
    resource.fail(USER_A_NIGHT_5, { kind: "not_found", status: 404, detail: null });
    await resource.load(USER_A_NIGHT_5);

    expect(calls).toHaveLength(2); // No request was made for user A.
    expect(read(USER_B_NIGHT_5)).toEqual(success([{ id: 2, selected: false }]));
  });

  test("an error for user A isn't shown for user B either", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    resource.close();
    resource.open(USER_B_NIGHT_5, 5);
    await calls[0].reject(httpError(403));
    expect(read(USER_B_NIGHT_5)).toEqual({ status: "loading" });
  });
});

describe("NightResource: mutations vs. older GETs", () => {
  async function loaded() {
    const ctx = setup();
    ctx.resource.open(USER_A_NIGHT_5, 5);
    await ctx.calls[0].resolve([
      { id: 1, selected: false },
      { id: 2, selected: true },
    ]);
    return ctx;
  }

  const selectGame1 = (list: Game[]) => list.map((g) => (g.id === 1 ? { ...g, selected: true } : g));

  test("a slow GET started before a mutation can't overwrite it", async () => {
    const { resource, calls, read } = await loaded();

    void resource.load(USER_A_NIGHT_5, true); // Background refresh starts (e.g. after an RSVP).
    resource.update(USER_A_NIGHT_5, selectGame1); // Host's add succeeds meanwhile.
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 1, selected: true }, { id: 2, selected: true }]));

    // The older GET answers with data from before the add.
    await calls[1].resolve([
      { id: 1, selected: false },
      { id: 2, selected: true },
    ]);
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 1, selected: true }, { id: 2, selected: true }]));
  });

  test("the dropped GET is replaced by a refetch that brings unrelated server changes", async () => {
    const { resource, calls, read } = await loaded();

    void resource.load(USER_A_NIGHT_5, true);
    resource.update(USER_A_NIGHT_5, selectGame1);
    expect(calls).toHaveLength(3); // initial + background GET + one follow-up refetch

    await calls[1].resolve([{ id: 1, selected: false }, { id: 2, selected: true }]);
    // Fresh server state: the add is there, and game 2 was unselected by someone else.
    await calls[2].resolve([{ id: 1, selected: true }, { id: 2, selected: false }]);
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 1, selected: true }, { id: 2, selected: false }]));
    expect(resource.pendingRequests).toBe(0);
  });

  test("the follow-up refetch is quiet: a failure keeps the confirmed change on screen", async () => {
    const { resource, calls, read } = await loaded();
    void resource.load(USER_A_NIGHT_5, true);
    resource.update(USER_A_NIGHT_5, selectGame1);

    await calls[2].reject(networkError);
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 1, selected: true }, { id: 2, selected: true }]));
  });

  test("no extra request when nothing was in flight", async () => {
    const { resource, calls, read } = await loaded();
    resource.update(USER_A_NIGHT_5, selectGame1);
    expect(calls).toHaveLength(1);
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 1, selected: true }, { id: 2, selected: true }]));
  });

  test('"always" refetches exactly once, even when a GET was also dropped', async () => {
    const { resource, calls } = await loaded();
    void resource.load(USER_A_NIGHT_5, true);
    resource.update(USER_A_NIGHT_5, selectGame1, "always");
    expect(calls).toHaveLength(3);

    resource.update(USER_A_NIGHT_5, (list) => list, "always"); // With nothing else in flight but the refetch.
    expect(calls).toHaveLength(4);
  });

  test('"never" drops older GETs without refetching (the server sent the full new data)', async () => {
    const { resource, calls, read } = await loaded();
    void resource.load(USER_A_NIGHT_5, true);
    resource.update(USER_A_NIGHT_5, () => [{ id: 7, selected: true }], "never");
    expect(calls).toHaveLength(2);

    await calls[1].resolve([{ id: 1, selected: false }]);
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 7, selected: true }]));
  });

  test("repeated mutations while a refetch runs: only the newest answer writes, and it stops", async () => {
    const { resource, calls, read } = await loaded();
    void resource.load(USER_A_NIGHT_5, true); // calls[1]
    resource.update(USER_A_NIGHT_5, selectGame1); // drops [1], refetch calls[2]
    resource.update(USER_A_NIGHT_5, (list) => [...list, { id: 3, selected: true }]); // drops [2], refetch calls[3]
    expect(calls).toHaveLength(4);

    // Answers arrive newest-first and oldest-last.
    await calls[3].resolve([{ id: 1, selected: true }, { id: 2, selected: true }, { id: 3, selected: true }]);
    await calls[2].resolve([{ id: 1, selected: true }, { id: 2, selected: true }]);
    await calls[1].resolve([{ id: 1, selected: false }, { id: 2, selected: true }]);

    expect(read(USER_A_NIGHT_5)).toEqual(
      success([{ id: 1, selected: true }, { id: 2, selected: true }, { id: 3, selected: true }]),
    );
    expect(calls).toHaveLength(4); // No refetch loop.
    expect(resource.pendingRequests).toBe(0);
  });

  test("overlapping GETs: an older one finishing last is ignored", async () => {
    const { resource, calls, read } = await loaded();
    void resource.load(USER_A_NIGHT_5, true); // calls[1]
    void resource.load(USER_A_NIGHT_5, true); // calls[2]
    await calls[2].resolve([{ id: 2, selected: false }]);
    await calls[1].resolve([{ id: 1, selected: false }]);
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 2, selected: false }]));
  });

  test("an update arriving while the initial load is still running doesn't leave the page loading", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    resource.update(USER_A_NIGHT_5, selectGame1); // Nothing to change yet, but the GET is dropped.
    expect(calls).toHaveLength(2);

    await calls[1].reject(networkError); // The quiet refetch fails with no data to keep.
    expect(read(USER_A_NIGHT_5).status).toBe("error");
  });
});

describe("NightResource: errors, fail() and closing", () => {
  test("a quiet reload failure keeps the data shown, but 404 means the night is gone", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    await calls[0].resolve([{ id: 1, selected: false }]);

    void resource.load(USER_A_NIGHT_5, true);
    await calls[1].reject(httpError(500));
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 1, selected: false }]));

    void resource.load(USER_A_NIGHT_5, true);
    await calls[2].reject(httpError(404));
    expect(read(USER_A_NIGHT_5)).toMatchObject({ status: "error", error: { kind: "not_found" } });
  });

  test("a non-quiet reload shows loading, then the result (Retry)", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    await calls[0].reject(networkError);
    expect(read(USER_A_NIGHT_5)).toMatchObject({ status: "error", error: { kind: "network" } });

    void resource.load(USER_A_NIGHT_5);
    expect(read(USER_A_NIGHT_5)).toEqual({ status: "loading" });
    await calls[1].resolve([{ id: 1, selected: false }]);
    expect(read(USER_A_NIGHT_5)).toEqual(success([{ id: 1, selected: false }]));
  });

  test("fail() drops a response still on its way", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    resource.fail(USER_A_NIGHT_5, { kind: "not_found", status: 404, detail: null });
    await calls[0].resolve([{ id: 1, selected: false }]);
    expect(read(USER_A_NIGHT_5)).toMatchObject({ status: "error", error: { kind: "not_found" } });
  });

  test("unmount or sign-out during a request aborts it and ignores the response", async () => {
    const { resource, calls, read } = setup();
    resource.open(USER_A_NIGHT_5, 5);
    resource.close();

    expect(calls[0].signal.aborted).toBe(true);
    await calls[0].reject(new CanceledError());
    await calls[0].resolve([{ id: 1, selected: false }]);
    expect(resource.getSnapshot()).toEqual({ scope: null, value: { status: "loading" } });

    resource.update(USER_A_NIGHT_5, (list) => list, "always");
    await resource.load(USER_A_NIGHT_5);
    expect(calls).toHaveLength(1); // Nothing runs after closing.
    expect(read(USER_A_NIGHT_5)).toEqual({ status: "loading" });
  });

  test("subscribers hear about every visible change and can unsubscribe", async () => {
    const { resource, calls } = setup();
    let notified = 0;
    const unsubscribe = resource.subscribe(() => notified++);
    resource.open(USER_A_NIGHT_5, 5);
    await calls[0].resolve([{ id: 1, selected: false }]);
    expect(notified).toBe(1);

    unsubscribe();
    resource.update(USER_A_NIGHT_5, (list) => list);
    expect(notified).toBe(1);
  });
});
