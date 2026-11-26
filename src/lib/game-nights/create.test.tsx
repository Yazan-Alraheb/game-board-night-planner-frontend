/// <reference types="bun" />
// Create Game Night: request body, submit/redirect flow, API helper and list states.
// The shared Axios instance is stubbed, so nothing reaches the backend or its database.
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { AxiosError } from "axios";
import { renderToStaticMarkup } from "react-dom/server";
import api from "@/api/client";
import { getApiErrorInfo } from "@/api/errors";
import { getFriends } from "@/api/friends";
import { createGameNight } from "@/api/game-nights";
import PickerState from "@/components/game-nights/PickerState";
import {
  buildCreateBody,
  createErrorMessage,
  submitGameNight,
  type CreateFormValues,
} from "@/lib/game-nights/create";
import type { UserResource } from "@/lib/user-resource";
import type { GameNightCreate, GameNightResponse } from "@/types/game-night";

const spies: { mockRestore(): void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

const values: CreateFormValues = {
  name: "  Friday Night  ",
  startsAt: "2030-06-07T19:30",
  location: " 42 Maple Street ",
  notes: "   ",
};

const night = (id: number): GameNightResponse => ({
  id,
  host_id: 1,
  name: "Friday Night",
  starts_at: "2030-06-08T02:30:00Z",
  location: "42 Maple Street",
  notes: null,
  created_at: "2030-01-01T00:00:00Z",
});

function httpError(status: number, detail: unknown = "Nope"): AxiosError {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { detail },
  });
}

const body: GameNightCreate = {
  name: "Friday Night",
  starts_at: "2030-06-08T02:30:00.000Z",
  location: "42 Maple Street",
  notes: null,
  game_ids: [],
  invitee_ids: [],
};

describe("buildCreateBody", () => {
  test("trims text, turns blank notes into null and sends the local time as UTC", () => {
    const result = buildCreateBody(values, [], [], new Set(), new Set());
    expect("body" in result).toBe(true);
    if (!("body" in result)) return;

    expect(result.body.name).toBe("Friday Night");
    expect(result.body.location).toBe("42 Maple Street");
    expect(result.body.notes).toBeNull();
    expect(result.body.starts_at).toBe(new Date(2030, 5, 7, 19, 30).toISOString());
    expect(result.body.starts_at.endsWith("Z")).toBe(true);
  });

  test("only sends selected games and friends that are in the loaded lists", () => {
    const result = buildCreateBody(values, [1, 2, 99], [5, 77], new Set([1, 2]), new Set([5]));
    expect(result).toMatchObject({ body: { game_ids: [1, 2], invitee_ids: [5] } });
  });

  test("an empty or impossible date is refused instead of throwing", () => {
    expect(buildCreateBody({ ...values, startsAt: "" }, [], [], new Set(), new Set())).toEqual({
      error: "Enter a valid date and time.",
    });
    expect(buildCreateBody({ ...values, startsAt: "2030-02-30T19:00" }, [], [], new Set(), new Set())).toEqual({
      error: "Enter a valid date and time.",
    });
  });
});

describe("submitGameNight", () => {
  test("success navigates to the new night's details page, not Home", async () => {
    const navigate = mock((_path: string) => {});
    const outcome = await submitGameNight(body, {
      create: async () => night(42),
      navigate,
      isCurrent: () => true,
    });

    expect(outcome).toEqual({ status: "created", path: "/game-nights/42" });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/game-nights/42");
  });

  test("failure reports a message and doesn't navigate", async () => {
    const navigate = mock((_path: string) => {});
    const outcome = await submitGameNight(body, {
      create: async () => {
        throw httpError(403, "You can only invite accepted friends");
      },
      navigate,
      isCurrent: () => true,
    });

    expect(outcome).toEqual({ status: "error", message: "You can only invite accepted friends" });
    expect(navigate).not.toHaveBeenCalled();
  });

  test("a response after the user changed or left is ignored", async () => {
    const navigate = mock((_path: string) => {});
    let current = true;

    const pending = submitGameNight(body, {
      create: async () => {
        current = false; // e.g. signed out and in as someone else while the POST ran
        return night(42);
      },
      navigate,
      isCurrent: () => current,
    });

    expect(await pending).toEqual({ status: "stale" });
    expect(navigate).not.toHaveBeenCalled();
  });

  test("a failure after the user changed is not shown either", async () => {
    const outcome = await submitGameNight(body, {
      create: async () => {
        throw httpError(500);
      },
      navigate: () => {},
      isCurrent: () => false,
    });
    expect(outcome).toEqual({ status: "stale" });
  });
});

describe("createErrorMessage", () => {
  test("shows the backend's explanation for expected rejections", () => {
    expect(createErrorMessage(httpError(400, "You cannot invite yourself"))).toBe("You cannot invite yourself");
    expect(createErrorMessage(httpError(404, "Game not found"))).toBe("Game not found");
  });

  test("never shows raw validation arrays or server errors", () => {
    expect(createErrorMessage(httpError(422, [{ loc: ["body", "name"], msg: "x" }]))).toBe(
      "Please check the details and try again.",
    );
    expect(createErrorMessage(httpError(500, "Traceback ..."))).toBe("Unable to create game night. Please try again.");
    expect(createErrorMessage(new AxiosError("timeout", "ECONNABORTED"))).toContain("Couldn't reach the server");
  });
});

describe("API helpers", () => {
  test("createGameNight posts to /game-nights and returns the created night", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { game_night: night(42) } } as never);
    spies.push(post);

    expect((await createGameNight(body)).id).toBe(42);
    expect(post).toHaveBeenCalledWith("/game-nights", body);
  });

  test("createGameNight rejects a response without an id", async () => {
    spies.push(spyOn(api, "post").mockResolvedValue({ data: {} } as never));
    await expect(createGameNight(body)).rejects.toThrow("Unexpected response format");
  });

  test("getFriends forwards the abort signal and rejects malformed responses", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: { friends: [] } } as never);
    spies.push(get);
    const signal = new AbortController().signal;

    await getFriends(signal);
    expect(get).toHaveBeenCalledWith("/friends", { signal });

    get.mockResolvedValue({ data: {} } as never);
    await expect(getFriends()).rejects.toThrow("Unexpected response format");
  });
});

describe("PickerState", () => {
  function render(resource: UserResource<readonly string[]>): string {
    return renderToStaticMarkup(
      <PickerState resource={resource} noun="your games" onRetry={() => {}} empty="No games in your collection yet.">
        {(items) => <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>}
      </PickerState>,
    );
  }

  test("loading is not shown as an empty list", () => {
    const html = render({ status: "loading" });
    expect(html).toContain("Loading your games");
    expect(html).not.toContain("No games in your collection yet.");
  });

  test("a failed request shows an error with Try again, not the empty message", () => {
    const html = render({ status: "error", error: getApiErrorInfo(httpError(500)) });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t load your games.");
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
    expect(html).not.toContain("No games in your collection yet.");
  });

  test("an empty list shows the empty message", () => {
    expect(render({ status: "success", data: [] })).toContain("No games in your collection yet.");
  });

  test("a loaded list renders its items", () => {
    expect(render({ status: "success", data: ["Azul", "Codenames"] })).toContain("<li>Azul</li><li>Codenames</li>");
  });
});
