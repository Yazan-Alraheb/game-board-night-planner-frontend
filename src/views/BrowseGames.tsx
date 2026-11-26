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

const GAMES_PER_PAGE = 8;

function BrowseGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    players: "",
    category: "",
    difficulty: "",
    playtime: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Loads games whenever the page or filters change.
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
  }, [filters, page]);

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
            <div>
              <label
                htmlFor="category"
                className="mb-2 block font-semibold"
              >
                Category
              </label>

              <select
                id="category"
                value={filters.category}
                onChange={(event) =>
                  updateFilter("category", event.target.value)
                }
                className="h-11 w-full rounded-lg border px-3"
              >
                <option value="">All categories</option>
                <option value="Family">Family</option>
                <option value="Strategy">Strategy</option>
                <option value="Classic">Classic</option>
                <option value="Deduction">Deduction</option>
                <option value="War Game">War Game</option>
                <option value="Word Game">Word Game</option>
                <option value="Card Game">Card Game</option>
                <option value="Children">Children</option>
                <option value="Dexterity">Dexterity</option>
                <option value="Party">Party</option>
              </select>
            </div>

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
          <p className="mt-8 text-red-500" role="alert">
            Unable to load games.
          </p>
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