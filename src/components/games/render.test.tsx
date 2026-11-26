/// <reference types="bun" />
// Static-render checks with react-dom/server (no DOM or extra test framework needed).
import { describe, expect, test } from "bun:test";
import { AxiosError } from "axios";
import { renderToStaticMarkup } from "react-dom/server";
import { getApiErrorInfo } from "@/api/errors";
import GameDetailsView, { type GameDetailsViewProps } from "@/components/games/GameDetailsView";
import type { Game } from "@/types/game";

const game: Game = {
  id: 3,
  name: "Harbor Lights",
  description: "Guide your ships home.",
  minimum_players: 2,
  maximum_players: 5,
  playtime: 45,
  difficulty: "Medium",
  categories: ["Strategy"],
  image_url: null,
  rating: 4.2,
  review_count: 10,
  instructions: null,
};

const noop = () => {};

function render(props: Partial<GameDetailsViewProps>): string {
  return renderToStaticMarkup(
    <GameDetailsView
      game={{ status: "success", data: game }}
      collection={{ status: "signed-out" }}
      onRetryGame={noop}
      onSave={noop}
      onRemove={noop}
      onRetryCollection={noop}
      {...props}
    />,
  );
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

const buttons = (html: string) =>
  [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));

describe("logged out", () => {
  test("the public details are shown with a login prompt and no collection buttons", () => {
    const html = render({ collection: { status: "signed-out" } });
    expect(html).toContain("Harbor Lights");
    expect(html).toContain("Guide your ships home.");
    expect(html).toContain('href="/login"');
    expect(buttons(html)).toEqual([]);
  });
});

describe("collection status", () => {
  test("while checking, no Add button is offered", () => {
    const html = render({ collection: { status: "loading" } });
    expect(html).toContain("Checking your collection");
    expect(buttons(html)).toEqual([]);
  });

  test("an owned game shows Owned and no Add action", () => {
    const html = render({ collection: { status: "ready", saved: "owned", pending: null, notice: null } });
    expect(html).toContain("Owned");
    expect(buttons(html)).toEqual(["Move to Wishlist", "Remove"]);
  });

  test("a wishlisted game shows Wishlist and no Add action", () => {
    const html = render({ collection: { status: "ready", saved: "wishlist", pending: null, notice: null } });
    expect(html).toContain("Wishlist: this game is on your wishlist.");
    expect(buttons(html)).toEqual(["Move to Collection", "Remove"]);
  });

  test("an unsaved game can be added", () => {
    const html = render({ collection: { status: "ready", saved: null, pending: null, notice: null } });
    expect(buttons(html)).toEqual(["Add to Collection", "Add to Wishlist"]);
  });

  test("while an action runs every control is disabled", () => {
    const html = render({ collection: { status: "ready", saved: null, pending: "add-owned", notice: null } });
    expect(buttons(html)).toEqual(["Saving…", "Add to Wishlist"]);
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(2);
    expect(html).toContain('aria-busy="true"');
  });

  test("errors are announced as alerts, successes as status", () => {
    const failed = render({
      collection: { status: "ready", saved: "owned", pending: null, notice: { tone: "error", text: "Could not move." } },
    });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Could not move.");

    const saved = render({
      collection: { status: "ready", saved: "owned", pending: null, notice: { tone: "success", text: "Added." } },
    });
    expect(saved).toMatch(/role="status"[^>]*>Added\./);
  });

  test("a failed lookup offers a retry and no save buttons", () => {
    const html = render({ collection: { status: "error", error: getApiErrorInfo(httpError(500)) } });
    expect(html).toContain('role="alert"');
    expect(buttons(html)).toEqual(["Try Again"]);
  });
});

describe("loading the game", () => {
  test("loading has its own state", () => {
    const html = render({ game: { status: "loading" } });
    expect(html).toContain("Loading game");
    expect(html).not.toContain("Game not found");
  });

  test("a real 404 shows Game not found without a retry", () => {
    const html = render({ game: { status: "error", error: getApiErrorInfo(httpError(404)) } });
    expect(html).toContain("Game not found");
    expect(buttons(html)).toEqual([]);
  });

  test("an invalid id shows Game not found", () => {
    expect(render({ game: null })).toContain("Game not found");
  });

  test("a server error is not 'not found' and offers Try Again", () => {
    const html = render({ game: { status: "error", error: getApiErrorInfo(httpError(500)) } });
    expect(html).not.toContain("Game not found");
    expect(html).toContain("Couldn&#x27;t load this game");
    expect(html).toContain('role="alert"');
    expect(buttons(html)).toEqual(["Try Again"]);
  });

  test("a network error is not 'not found' and offers Try Again", () => {
    const html = render({ game: { status: "error", error: getApiErrorInfo(new AxiosError("Network Error", "ERR_NETWORK")) } });
    expect(html).not.toContain("Game not found");
    expect(html).toContain("connection");
    expect(buttons(html)).toEqual(["Try Again"]);
  });
});
