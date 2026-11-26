"use client";

import { useEffect, useState } from "react";
import { getGameCategories, getGames } from "@/api/games";
import CategoryFilter from "@/components/games/CategoryFilter";
import { Button } from "@/components/ui/button";
import GameCard from "@/components/home/GameCard";
import { useLazyResource } from "@/hooks/useLazyResource";
import {
  browseGamesParams,
  EMPTY_BROWSE_FILTERS,
  type BrowseFilters as Filters,
  type Difficulty,
} from "@/lib/games/browse-filters";
import type { Game } from "@/types/game";

const GAMES_PER_PAGE = 8;

function BrowseGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<Filters>(EMPTY_BROWSE_FILTERS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Categories come from the catalog itself (same source as Find a Game and Profile),
  // loaded once per visit; changing filters doesn't reload them.
  const [categories, retryCategories] = useLazyResource(getGameCategories, true);

  // Loads games whenever the page or filters change.
  useEffect(() => {
    const controller = new AbortController();

    // Wait briefly after typing before calling the API.
    const timeoutId = window.setTimeout(() => {
      getGames(
        browseGamesParams(filters, page, GAMES_PER_PAGE),
        controller.signal,
      )
        .then((data) => {
          const lastPage = Math.max(
            1,
            Math.ceil(data.total / GAMES_PER_PAGE),
          );

          // If filtering reduces the number of pages,
          // move to the last valid page.
          if (page > lastPage) {
            setTotal(data.total);
            setPage(lastPage);
            return;
          }

          setGames(data.games);
          setTotal(data.total);
          setLoading(false);
          setError(false);
        })
        .catch(() => {
          // Ignore requests cancelled by a newer request.
          if (controller.signal.aborted) return;

          setError(true);
          setLoading(false);
        });
    }, 300);

    // Cancel the timer and old request when inputs change.
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [filters, page, reloadKey]);

  // Loads the current page again after a failure, keeping every filter.
  function retryGames() {
    setLoading(true);
    setError(false);
    setReloadKey((key) => key + 1);
  }

  // Updates one filter and starts from page one.
  function updateFilter<K extends keyof Filters>(
    key: K,
    value: Filters[K],
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
    setGames([]);
    setLoading(true);
    setError(false);
  }

  // Clears all filters.
  function resetFilters() {
    setFilters(EMPTY_BROWSE_FILTERS);

    setPage(1);
    setGames([]);
    setLoading(true);
    setError(false);
  }

  const totalPages = Math.max(
    1,
    Math.ceil(total / GAMES_PER_PAGE),
  );

  return (
    <div className="min-h-screen bg-surface-warm">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-heading text-4xl font-bold">
          Browse Games
        </h1>

        <p className="mt-2 text-muted-foreground">
          Find a game for your next game night.
        </p>

        {/* Search and filter controls. */}
        <div className="mt-8 rounded-2xl bg-white p-5">
          {/* Search bar. */}
          <div>
            <label
              htmlFor="game-search"
              className="mb-2 block font-semibold"
            >
              Search games
            </label>

            <input
              id="game-search"
              type="search"
              value={filters.search}
              onChange={(event) =>
                updateFilter("search", event.target.value)
              }
              placeholder="Search by game name or description..."
              className="h-12 w-full rounded-lg border px-3"
            />
          </div>

          {/* Dropdown filters. */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Players dropdown. */}
            <div>
              <label
                htmlFor="players"
                className="mb-2 block font-semibold"
              >
                Players
              </label>

              <select
                id="players"
                value={filters.players}
                onChange={(event) =>
                  updateFilter("players", event.target.value)
                }
                className="h-11 w-full rounded-lg border px-3"
              >
                <option value="">Any number of players</option>

                {[1, 2, 3, 4, 5, 6, 8, 10, 16].map(
                  (number) => (
                    <option key={number} value={number}>
                      {number} player
                      {number !== 1 ? "s" : ""}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Category dropdown. */}
            <CategoryFilter
              categories={categories}
              value={filters.category}
              onChange={(category) => updateFilter("category", category)}
              onRetry={retryCategories}
              className="h-11 w-full rounded-lg border px-3"
            />

            {/* Difficulty dropdown. */}
            <div>
              <label
                htmlFor="difficulty"
                className="mb-2 block font-semibold"
              >
                Difficulty
              </label>

              <select
                id="difficulty"
                value={filters.difficulty}
                onChange={(event) =>
                  updateFilter(
                    "difficulty",
                    event.target.value as Difficulty | "",
                  )
                }
                className="h-11 w-full rounded-lg border px-3"
              >
                <option value="">All difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {/* Maximum playtime dropdown. */}
            <div>
              <label
                htmlFor="playtime"
                className="mb-2 block font-semibold"
              >
                Maximum playtime
              </label>

              <select
                id="playtime"
                value={filters.playtime}
                onChange={(event) =>
                  updateFilter("playtime", event.target.value)
                }
                className="h-11 w-full rounded-lg border px-3"
              >
                <option value="">Any playtime</option>
                <option value="15">15 minutes or less</option>
                <option value="20">20 minutes or less</option>
                <option value="30">30 minutes or less</option>
                <option value="45">45 minutes or less</option>
                <option value="60">60 minutes or less</option>
                <option value="120">
                  120 minutes or less
                </option>
              </select>
            </div>
          </div>

          {/* Reset button. */}
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-lg border px-5 py-2"
          >
            Reset filters
          </button>
        </div>

        {/* Loading message. */}
        {loading && (
          <p className="mt-8" role="status">
            Loading games...
          </p>
        )}

        {/* Error message. */}
        {error && (
          <div role="alert" className="mt-8 flex flex-wrap items-center gap-3">
            <p className="text-destructive">Unable to load games.</p>
            <Button
              type="button"
              variant="outline"
              onClick={retryGames}
              className="rounded-lg"
            >
              Try again
            </Button>
          </div>
        )}

        {/* Empty results message. */}
        {!loading && !error && games.length === 0 && (
          <p className="mt-8">
            No games found.
          </p>
        )}

        {/* Game cards. */}
        {!loading && !error && games.length > 0 && (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {games.map((game) => (
              <li key={game.id}>
                <GameCard game={game} />
              </li>
            ))}
          </ul>
        )}

        {/* Pagination. */}
        {!loading && !error && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => {
                setGames([]);
                setLoading(true);
                setPage((current) => current - 1);
              }}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              Previous
            </button>

            <span>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                setGames([]);
                setLoading(true);
                setPage((current) => current + 1);
              }}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowseGames;