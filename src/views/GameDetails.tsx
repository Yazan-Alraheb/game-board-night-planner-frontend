"use client";

import axios from "axios";
import Link from "next/link";
import { ArrowLeft, Clock, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getGame } from "@/api/games";
import {
  addToCollection,
  type CollectionStatus,
} from "@/api/collection";
import { useAuth } from "@/auth/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatPlayerRange,
  formatPlaytime,
  getInitials,
  placeholderColor,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Game } from "@/types/game";

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; game: Game };

interface GameDetailsProps {
  id: string;
}

function GameDetails({ id }: GameDetailsProps) {
  const { session } = useAuth();

  const [state, setState] = useState<PageState>({
    status: "loading",
  });
  const [savingStatus, setSavingStatus] =
    useState<CollectionStatus | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Read the game ID from the URL.
    const gameId = Number(id);
    const controller = new AbortController();

    if (!Number.isInteger(gameId)) {
      setState({ status: "error" });
      return () => controller.abort();
    }

    getGame(gameId, controller.signal)
      .then((game) => {
        setState({ status: "success", game });
      })
      .catch((error: unknown) => {
        if (!axios.isCancel(error)) {
          setState({ status: "error" });
        }
      });

    return () => controller.abort();
  }, [id]);

  async function saveGame(
    status: CollectionStatus,
    gameId: number,
  ) {
    if (!session) {
      setMessage("Log in to save this game.");
      return;
    }

    try {
      setSavingStatus(status);
      setMessage("");

      await addToCollection(session.user.id, gameId, status);

      setMessage(
        status === "owned"
          ? "Added to your collection."
          : "Added to your wishlist.",
      );
    } catch {
      setMessage("Could not save this game.");
    } finally {
      setSavingStatus(null);
    }
  }

  if (state.status === "loading") {
    return <p className="p-12 text-center">Loading game...</p>;
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <h1 className="text-3xl font-bold">Game not found</h1>

        <Link
          href="/browse"
          className="mt-6 inline-block rounded-lg bg-brand-strong px-5 py-3 text-white"
        >
          Back to games
        </Link>
      </div>
    );
  }

  const { game } = state;

  return (
    <div className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-brand-strong"
        >
          <ArrowLeft className="size-4" />
          Back to games
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Card className="overflow-hidden rounded-2xl p-0">
            <div className="aspect-4/3 bg-white">
              {game.image_url ? (
                <img
                  src={game.image_url}
                  alt={game.name}
                  className="size-full object-contain p-6"
                />
              ) : (
                <div
                  className={cn(
                    "flex size-full items-center justify-center text-6xl font-bold",
                    placeholderColor(game.id),
                  )}
                >
                  {getInitials(game.name)}
                </div>
              )}
            </div>
          </Card>

          <div>
            <div className="flex flex-wrap gap-2">
              {game.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>

            <h1 className="mt-4 text-4xl font-bold">
              {game.name}
            </h1>

            {game.description && (
              <p className="mt-5 text-lg text-muted-foreground">
                {game.description}
              </p>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4 text-brand" />
                  Players
                </p>
                <p className="mt-2 font-semibold">
                  {formatPlayerRange(
                    game.minimum_players,
                    game.maximum_players,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4 text-brand" />
                  Play time
                </p>
                <p className="mt-2 font-semibold">
                  {formatPlaytime(game.playtime)}
                </p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="size-4 text-brand" />
                  Rating
                </p>
                <p className="mt-2 font-semibold">
                  {game.rating === null
                    ? "No rating"
                    : game.rating.toFixed(1)}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-white p-6">
              <h2 className="text-2xl font-bold">
                Save this game
              </h2>

              {session ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={savingStatus !== null}
                    onClick={() =>
                      saveGame("owned", game.id)
                    }
                    className="rounded-xl bg-brand-strong px-5 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {savingStatus === "owned"
                      ? "Saving..."
                      : "Add to Collection"}
                  </button>

                  <button
                    type="button"
                    disabled={savingStatus !== null}
                    onClick={() =>
                      saveGame("wishlist", game.id)
                    }
                    className="rounded-xl border border-brand-strong px-5 py-3 font-semibold text-brand-strong disabled:opacity-50"
                  >
                    {savingStatus === "wishlist"
                      ? "Saving..."
                      : "Add to Wishlist"}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-muted-foreground">
                  Log in to save this game.
                </p>
              )}

              {message && (
                <p
                  role="status"
                  className="mt-3 text-sm text-muted-foreground"
                >
                  {message}
                </p>
              )}
            </div>

            <div className="mt-8 rounded-2xl bg-white p-6">
              <h2 className="text-2xl font-bold">
                More information
              </h2>

              <p className="mt-4">
                <strong>Difficulty:</strong> {game.difficulty}
              </p>

              {game.instructions && (
                <p className="mt-4 whitespace-pre-line text-muted-foreground">
                  {game.instructions}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameDetails;
