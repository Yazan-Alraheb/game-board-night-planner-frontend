"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGame } from "@/api/games";
import type { Game } from "@/types/game";

interface GameDetailsProps {
  id: string;
}

function GameDetails({ id }: GameDetailsProps) {
  // Stores the game returned by the backend.
  const [game, setGame] = useState<Game | null>(null);

  // Tracks loading and errors.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const gameId = Number(id);

    // Prevents invalid URLs such as /games/abc.
    if (!Number.isInteger(gameId)) {
      setError(true);
      setLoading(false);
      return () => controller.abort();
    }

    // Requests the selected game.
    getGame(gameId, controller.signal)
      .then((data) => {
        setGame(data);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;

        setError(true);
        setLoading(false);
      });

    // Cancels the request if the user leaves the page.
    return () => controller.abort();
  }, [id]);

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-12">Loading game...</p>;
  }

  if (error || !game) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-red-500">Unable to load this game.</p>

        <Link
          href="/browse"
          className="mt-6 inline-block rounded-lg border px-4 py-2"
        >
          Back to games
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-warm">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/browse"
          className="text-brand-strong hover:underline"
        >
          ← Back to games
        </Link>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="font-heading text-4xl font-bold">
            {game.name}
          </h1>

          <p className="mt-4 text-muted-foreground">
            {game.description ?? "No description available."}
          </p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Players</dt>
              <dd>
                {game.minimum_players}–{game.maximum_players}
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Playtime</dt>
              <dd>{game.playtime} minutes</dd>
            </div>

            <div>
              <dt className="font-semibold">Difficulty</dt>
              <dd>{game.difficulty}</dd>
            </div>

            <div>
              <dt className="font-semibold">Categories</dt>
              <dd>{game.categories.join(", ")}</dd>
            </div>

            <div>
              <dt className="font-semibold">Rating</dt>
              <dd>{game.rating ?? "Not rated"}</dd>
            </div>
          </dl>

          {game.instructions && (
            <div className="mt-8">
              <h2 className="text-xl font-bold">Instructions</h2>
              <p className="mt-2 text-muted-foreground">
                {game.instructions}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameDetails;