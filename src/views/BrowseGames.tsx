"use client";

import { useEffect, useState } from "react";
import { getGames } from "@/api/games";
import GameCard from "@/components/home/GameCard";
import type { Game } from "@/types/game";

type Difficulty = "Easy" | "Medium" | "Hard";

interface Filters {
  search: string;
  players: string;
  category: string;
  difficulty: Difficulty | "";
  playtime: string;
}

// Number of games requested for each page.
const GAMES_PER_PAGE = 8;

function BrowseGames() {
  // Games received from the backend.
  const [games, setGames] = useState<Game[]>([]);

  // Total matching games, used to calculate pagination.
  const [total, setTotal] = useState(0);

  // Current page number.
  const [page, setPage] = useState(1);

  // Filter values controlled by the inputs.
  const [filters, setFilters] = useState<Filters>({
    search: "",
    players: "",
    category: "",
    difficulty: "",
    playtime: "",
  });

  // Initial loading state.
  const [loading, setLoading] = useState(true);

  // API error state.
  const [error, setError] = useState(false);

  // Loads games when filters or page change.
  useEffect(() => {
    const controller = new AbortController();

    // Wait briefly after typing before calling the API.
    const timeoutId = window.setTimeout(() => {
      getGames(
        {
          page,
          limit: GAMES_PER_PAGE,
          search: filters.search || undefined,
          players: filters.players
            ? Number(filters.players)
            : undefined,
          category: filters.category || undefined,
          difficulty: filters.difficulty || undefined,
          playtime: filters.playtime
            ? Number(filters.playtime)
            : undefined,
        },
        controller.signal,
      )
        .then((data) => {
          // Calculate the last valid page.
          const lastPage = Math.max(
            1,
            Math.ceil(data.total / GAMES_PER_PAGE),
          );

          // If the current page no longer exists, move to the last page.
          if (page > lastPage) {
            setTotal(data.total);
            setPage(lastPage);
            return;
          }

          // Save the new games and total count.
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
  }, [filters, page]);

  // Updates one filter and immediately prepares the page for new results.
  function updateFilter<K extends keyof Filters>(
    key: K,
    value: Filters[K],
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    // New filters should always begin at page one.
    setPage(1);

    // Remove old results immediately instead of displaying stale games.
    setGames([]);
    setLoading(true);
    setError(false);
  }

  // Clears all filters.
  function resetFilters() {
    setFilters({
      search: "",
      players: "",
      category: "",
      difficulty: "",
      playtime: "",
    });

    setPage(1);
    setGames([]);
    setLoading(true);
    setError(false);
  }

  // Calculates the total number of pages.
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
          {/* Search is separated and spans the full filter box. */}
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

          {/* Additional filters. */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="players"
                className="mb-2 block font-semibold"
              >
                Players
              </label>

              <input
                id="players"
                type="number"
                min="1"
                value={filters.players}
                onChange={(event) =>
                  updateFilter("players", event.target.value)
                }
                placeholder="Example: 4"
                className="h-11 w-full rounded-lg border px-3"
              />
            </div>

            <div>
              <label
                htmlFor="category"
                className="mb-2 block font-semibold"
              >
                Category
              </label>

              <input
                id="category"
                type="text"
                value={filters.category}
                onChange={(event) =>
                  updateFilter("category", event.target.value)
                }
                placeholder="Example: Strategy"
                className="h-11 w-full rounded-lg border px-3"
              />
            </div>

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

            <div>
              <label
                htmlFor="playtime"
                className="mb-2 block font-semibold"
              >
                Maximum playtime
              </label>

              <input
                id="playtime"
                type="number"
                min="1"
                value={filters.playtime}
                onChange={(event) =>
                  updateFilter("playtime", event.target.value)
                }
                placeholder="Minutes"
                className="h-11 w-full rounded-lg border px-3"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-lg border px-5 py-2"
          >
            Reset filters
          </button>
        </div>

        {/* Loading message appears while new results are loading. */}
        {loading && (
          <p className="mt-8" role="status">
            Loading games...
          </p>
        )}

        {/* Error message appears if the API request fails. */}
        {error && (
          <p className="mt-8 text-red-500" role="alert">
            Unable to load games.
          </p>
        )}

        {/* Message shown when no games match the filters. */}
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