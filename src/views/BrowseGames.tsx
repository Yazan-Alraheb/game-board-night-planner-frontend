"use client";

import { FormEvent, useEffect, useState } from "react";
import { getGames } from "@/api/games";
import GameCard from "@/components/home/GameCard";
import type { Game } from "@/types/game";

// Allowed difficulty values from the backend.
type Difficulty = "Easy" | "Medium" | "Hard";

// Values controlled by the filter form.
interface Filters {
  search: string;
  players: string;
  difficulty: Difficulty | "";
}

const GAMES_PER_PAGE = 8;

function BrowseGames() {
  // Games returned from the backend.
  const [games, setGames] = useState<Game[]>([]);

  // Total number of matching games in the database.
  const [total, setTotal] = useState(0);

  // Current page number.
  const [page, setPage] = useState(1);

  // Shows whether data is being loaded.
  const [loading, setLoading] = useState(true);

  // Shows whether the API request failed.
  const [error, setError] = useState(false);

  // Values currently typed into the form.
  const [draftFilters, setDraftFilters] = useState<Filters>({
    search: "",
    players: "",
    difficulty: "",
  });

  // Filters currently being used for the API request.
  const [filters, setFilters] = useState<Filters>({
    search: "",
    players: "",
    difficulty: "",
  });

  // Loads games whenever the page or filters change.
  useEffect(() => {
    const controller = new AbortController();

    // Requests games from FastAPI.
    getGames(
      {
        page,
        limit: GAMES_PER_PAGE,
        search: filters.search || undefined,
        players: filters.players
          ? Number(filters.players)
          : undefined,
        difficulty: filters.difficulty || undefined,
      },
      controller.signal,
    )
      .then((data) => {
        // Saves the returned games.
        setGames(data.games);

        // Saves the total for pagination.
        setTotal(data.total);

        // Stops the loading message.
        setLoading(false);
      })
      .catch(() => {
        // Ignore requests cancelled when leaving the page.
        if (controller.signal.aborted) return;

        // Shows the error message.
        setError(true);
        setLoading(false);
      });

    // Cancels the request if the component is removed.
    return () => controller.abort();
  }, [page, filters]);

  // Applies the form filters.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError(false);

    // Return to page one when a new search is performed.
    setPage(1);

    // Use the form values for the next API request.
    setFilters(draftFilters);
  }

  // Clears all filters.
  function handleReset() {

    setLoading(true);
    setError(false);

    const emptyFilters: Filters = {
      search: "",
      players: "",
      difficulty: "",
    };

    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  }

  // Calculates how many pages exist.
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

        {/* Search and filter form. */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-3"
        >
          {/* Search field. */}
          <input
            type="search"
            placeholder="Search games..."
            value={draftFilters.search}
            onChange={(event) =>
              setDraftFilters({
                ...draftFilters,
                search: event.target.value,
              })
            }
            className="h-11 rounded-lg border px-3"
          />

          {/* Player-count filter. */}
          <input
            type="number"
            min="1"
            placeholder="Number of players"
            value={draftFilters.players}
            onChange={(event) =>
              setDraftFilters({
                ...draftFilters,
                players: event.target.value,
              })
            }
            className="h-11 rounded-lg border px-3"
          />

          {/* Difficulty filter. */}
          <select
            value={draftFilters.difficulty}
            onChange={(event) =>
              setDraftFilters({
                ...draftFilters,
                difficulty: event.target.value as Difficulty | "",
              })
            }
            className="h-11 rounded-lg border px-3"
          >
            <option value="">All difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          {/* Form buttons. */}
          <div className="flex gap-3 sm:col-span-3">
            <button
              type="submit"
              className="rounded-lg bg-brand-strong px-5 py-2 font-semibold text-white"
            >
              Apply Filters
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border px-5 py-2"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Loading state. */}
        {loading && (
          <p className="mt-8">
            Loading games...
          </p>
        )}

        {/* Error state. */}
        {error && (
          <p className="mt-8 text-red-500">
            Unable to load games.
          </p>
        )}

        {/* Empty-results state. */}
        {!loading && !error && games.length === 0 && (
          <p className="mt-8">
            No games found.
          </p>
        )}

        {/* Games grid. */}
        {!loading && !error && games.length > 0 && (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {games.map((game) => (
              <li key={game.id}>
                <GameCard game={game} />
              </li>
            ))}
          </ul>
        )}

        {/* Pagination controls. */}
        {!loading && !error && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              Previous
            </button>

            <span>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
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