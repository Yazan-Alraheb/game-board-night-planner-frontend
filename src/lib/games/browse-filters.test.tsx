/// <reference types="bun" />
// Browse Games: backend-driven categories. The shared Axios instance is stubbed,
// so no request reaches the backend or its database.
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import api from "@/api/client";
import { getApiErrorInfo } from "@/api/errors";
import { getGameCategories } from "@/api/games";
import CategoryFilter from "@/components/games/CategoryFilter";
import type { LazyResource } from "@/hooks/useLazyResource";
import {
  browseGamesParams,
  categoryOptions,
  EMPTY_BROWSE_FILTERS,
} from "@/lib/games/browse-filters";
import type { Game } from "@/types/game";

const game = (id: number, categories: string[]): Game => ({
  id,
  name: `Game ${id}`,
  description: null,
  minimum_players: 2,
  maximum_players: 4,
  playtime: 30,
  difficulty: "Easy",
  categories,
  image_url: null,
  rating: null,
  review_count: null,
  instructions: null,
});

const spies: { mockRestore(): void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

const noop = () => {};

function renderFilter(categories: LazyResource<string[]>, value = ""): string {
  return renderToStaticMarkup(
    <CategoryFilter categories={categories} value={value} onChange={noop} onRetry={noop} />,
  );
}

const optionValues = (html: string) =>
  [...html.matchAll(/<option\b[^>]*value="([^"]*)"/g)].map((match) => match[1]);

describe("categories come from the catalog", () => {
  test("a category from a newly seeded game shows up without a code change", async () => {
    const get = spyOn(api, "get").mockResolvedValue({
      data: { games: [game(1, ["Strategy"]), game(2, ["Cooperative", "Card Game"])], total: 2, page: 1 },
    } as never);
    spies.push(get);

    const categories = await getGameCategories();

    expect(categories).toEqual(["Card Game", "Cooperative", "Strategy"]);
    expect(optionValues(renderFilter({ status: "success", data: categories }))).toEqual([
      "",
      "Card Game",
      "Cooperative",
      "Strategy",
    ]);
  });

  test("the dropdown has no built-in category list", () => {
    const html = renderFilter({ status: "success", data: ["Party"] });
    expect(optionValues(html)).toEqual(["", "Party"]);
    expect(html).not.toContain("War Game");
  });
});

describe("CategoryFilter states", () => {
  test("All categories is always available", () => {
    for (const state of [
      { status: "idle" },
      { status: "loading" },
      { status: "error", error: getApiErrorInfo(new Error("x")) },
      { status: "success", data: [] },
    ] as LazyResource<string[]>[]) {
      expect(renderFilter(state)).toMatch(/<option value=""[^>]*>All categories<\/option>/);
    }
  });

  test("loading shows a status message", () => {
    const html = renderFilter({ status: "loading" });
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading categories");
  });

  test("an error offers Try again and keeps the select usable", () => {
    const html = renderFilter({ status: "error", error: getApiErrorInfo(new Error("x")) });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t load categories.");
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
    expect(html).not.toMatch(/<select[^>]*disabled/);
  });

  test("an empty catalog says so", () => {
    expect(renderFilter({ status: "success", data: [] })).toContain("No categories are available yet.");
  });

  test("categories with spaces are kept verbatim as option values", () => {
    const html = renderFilter({ status: "success", data: ["Card Game", "War Game"] }, "Card Game");
    expect(optionValues(html)).toEqual(["", "Card Game", "War Game"]);
    expect(html).toMatch(/<option value="Card Game" selected="">Card Game<\/option>/);
  });
});

describe("categoryOptions", () => {
  test("keeps a selected category the catalog no longer has", () => {
    expect(categoryOptions(["Party"], "Retro")).toEqual(["Party", "Retro"]);
    expect(categoryOptions(null, "Retro")).toEqual(["Retro"]);
  });

  test("doesn't duplicate or add empty selections", () => {
    expect(categoryOptions(["Party"], "Party")).toEqual(["Party"]);
    expect(categoryOptions(["Party"], "")).toEqual(["Party"]);
  });
});

describe("browseGamesParams", () => {
  test("no filters sends only the page", () => {
    expect(browseGamesParams(EMPTY_BROWSE_FILTERS, 1, 8)).toEqual({
      page: 1,
      limit: 8,
      search: undefined,
      players: undefined,
      category: undefined,
      difficulty: undefined,
      playtime: undefined,
    });
  });

  test("a category with spaces is combined with the other filters unchanged", () => {
    expect(
      browseGamesParams(
        { search: "cats", players: "4", category: "Card Game", difficulty: "Easy", playtime: "30" },
        1,
        8,
      ),
    ).toEqual({ page: 1, limit: 8, search: "cats", players: 4, category: "Card Game", difficulty: "Easy", playtime: 30 });
  });

  test("the category reaches GET /api/games as a query parameter", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: { games: [], total: 0, page: 1 } } as never);
    spies.push(get);
    const { getGames } = await import("@/api/games");

    await getGames(browseGamesParams({ ...EMPTY_BROWSE_FILTERS, category: "Card Game" }, 1, 8));

    expect(get.mock.calls[0][0]).toBe("/games");
    expect((get.mock.calls[0][1] as { params: { category: string } }).params.category).toBe("Card Game");
  });
});
