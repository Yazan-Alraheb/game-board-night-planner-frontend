/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { AxiosError } from "axios";
import api from "@/api/client";
import { getApiErrorInfo } from "@/api/errors";
import { getGame } from "@/api/games";
import {
  describeCollectionLoadError,
  describeGameLoadError,
  gameScope,
  parseGameId,
} from "@/lib/games/game-details";
import { NightResource, readNightResource } from "@/lib/game-nights/night-resource";
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

describe("parseGameId", () => {
  test("accepts positive integers only", () => {
    expect(parseGameId("12")).toBe(12);
    for (const raw of ["0", "-3", "1.5", "abc", "", "01", undefined, ["1"]]) {
      expect(parseGameId(raw as string)).toBeNull();
    }
  });
});

describe("describeGameLoadError", () => {
  test("only a real 404 is 'not found'", () => {
    expect(describeGameLoadError(getApiErrorInfo(httpError(404)))).toEqual({ kind: "not_found" });
  });

  test("network, 5xx and unexpected failures are retryable with a useful message", () => {
    const network = describeGameLoadError(getApiErrorInfo(networkError));
    expect(network).toMatchObject({ kind: "retryable" });
    expect(network.kind === "retryable" && network.message).toContain("connection");

    const server = describeGameLoadError(getApiErrorInfo(httpError(500)));
    expect(server).toMatchObject({ kind: "retryable" });
    expect(server.kind === "retryable" && server.message).toContain("server");

    for (const error of [httpError(503), httpError(422), new Error("Unexpected response format")]) {
      expect(describeGameLoadError(getApiErrorInfo(error)).kind).toBe("retryable");
    }
  });

  test("collection lookup errors explain what failed", () => {
    expect(describeCollectionLoadError(getApiErrorInfo(networkError))).toContain("reach the server");
    expect(describeCollectionLoadError(getApiErrorInfo(httpError(500)))).toContain("check whether");
  });
});

// The page loads the game with NightResource(getGame) scoped by gameScope(id), as useGame does.
describe("loading a game (getGame through the scoped resource)", () => {
  const spies: { mockRestore(): void }[] = [];
  afterEach(() => {
    while (spies.length) spies.pop()!.mockRestore();
  });

  /** Stubs GET /games/{id}; each call waits until the test settles it. */
  function stubGames() {
    const calls: { url: string; signal: AbortSignal; resolve: (g: Game) => Promise<void>; reject: (e: unknown) => Promise<void> }[] = [];
    const settle = async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    };
    const get = spyOn(api, "get").mockImplementation(((url: string, config: { signal: AbortSignal }) =>
      new Promise((resolve, reject) => {
        calls.push({
          url,
          signal: config.signal,
          resolve: (g) => {
            resolve({ data: { game: g } });
            return settle();
          },
          reject: (e) => {
            reject(e);
            return settle();
          },
        });
      })) as never);
    spies.push(get);
    return calls;
  }

  test("a 404 reads as not found", async () => {
    const calls = stubGames();
    const resource = new NightResource(getGame);
    resource.open(gameScope(5)!, 5);
    expect(calls[0].url).toBe("/games/5");
    await calls[0].reject(httpError(404));

    const value = readNightResource(resource.getSnapshot(), gameScope(5));
    expect(value.status === "error" && describeGameLoadError(value.error)).toEqual({ kind: "not_found" });
  });

  test("a 500 is retryable, and Retry shows loading then the game", async () => {
    const calls = stubGames();
    const resource = new NightResource(getGame);
    const scope = gameScope(5);
    resource.open(scope!, 5);
    await calls[0].reject(httpError(500));

    const failed = readNightResource(resource.getSnapshot(), scope);
    expect(failed.status === "error" && describeGameLoadError(failed.error).kind).toBe("retryable");

    const retry = resource.load(scope);
    expect(readNightResource(resource.getSnapshot(), scope)).toEqual({ status: "loading" });
    await calls[1].resolve(game(5));
    await retry;
    expect(readNightResource(resource.getSnapshot(), scope)).toEqual({ status: "success", data: game(5) });
  });

  test("a network error is retryable", async () => {
    const calls = stubGames();
    const resource = new NightResource(getGame);
    resource.open(gameScope(5)!, 5);
    await calls[0].reject(networkError);
    const value = readNightResource(resource.getSnapshot(), gameScope(5));
    expect(value).toMatchObject({ status: "error", error: { kind: "network" } });
  });

  test("navigating to another id never shows the previous game's details", async () => {
    const calls = stubGames();
    const resource = new NightResource(getGame);
    resource.open(gameScope(5)!, 5);
    await calls[0].resolve(game(5));
    expect(readNightResource(resource.getSnapshot(), gameScope(5))).toMatchObject({ status: "success" });

    resource.open(gameScope(6)!, 6);
    // Game 5 is still in the snapshot, but reads as loading for game 6.
    expect(readNightResource(resource.getSnapshot(), gameScope(6))).toEqual({ status: "loading" });
    await calls[1].resolve(game(6));
    expect(readNightResource(resource.getSnapshot(), gameScope(6))).toEqual({ status: "success", data: game(6) });
  });

  test("a slow response for the previous id is aborted and ignored", async () => {
    const calls = stubGames();
    const resource = new NightResource(getGame);
    resource.open(gameScope(5)!, 5);
    resource.open(gameScope(6)!, 6);
    expect(calls[0].signal.aborted).toBe(true);

    await calls[1].resolve(game(6));
    await calls[0].resolve(game(5));
    expect(readNightResource(resource.getSnapshot(), gameScope(6))).toEqual({ status: "success", data: game(6) });
  });
});
