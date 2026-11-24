"use client";

import axios from "axios";
import Link from "next/link";
import { ArrowLeft, Clock, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getGame } from "@/api/games";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  formatPlayerRange,
  formatPlaytime,
  getInitials,
  placeholderColor,
} from "@/lib/format";
import type { Game } from "@/types/game";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; game: Game };

export default function GameDetailsPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const gameId = Number(params.id);

    if (!Number.isInteger(gameId)) {
      setState({ status: "error" });
      return () => controller.abort();
    }

    getGame(gameId, controller.signal)
      .then((game) => {
        setState({ status: "success", game });
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;

        console.error("Failed to load game details", error);
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, [params.id]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="aspect-4/3 animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-heading text-3xl font-bold">
          Game not found
        </h1>
        <p className="mt-3 text-muted-foreground">
          We could not load this game right now.
        </p>
        <Link
          href="/browse"
          className={cn(
            buttonVariants(),
            "mt-8 rounded-xl bg-brand-strong px-6 text-brand-foreground hover:bg-brand",
          )}
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
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-strong hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to games
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Card className="overflow-hidden rounded-2xl p-0">
            <div className="relative aspect-4/3 bg-white">
              {game.image_url ? (
                <img
                  src={game.image_url}
                  alt={game.name}
                  className="size-full object-contain p-6"
                />
              ) : (
                <div
                  className={cn(
                    "flex size-full items-center justify-center font-heading text-6xl font-bold",
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

            <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight">
              {game.name}
            </h1>

            {game.description && (
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                {game.description}
              </p>
            )}

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4 text-brand" aria-hidden="true" />
                  Players
                </dt>
                <dd className="mt-2 font-semibold">
                  {formatPlayerRange(
                    game.minimum_players,
                    game.maximum_players,
                  )}
                </dd>
              </div>

              <div className="rounded-xl bg-white p-4">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4 text-brand" aria-hidden="true" />
                  Play time
                </dt>
                <dd className="mt-2 font-semibold">
                  {formatPlaytime(game.playtime)}
                </dd>
              </div>

              <div className="rounded-xl bg-white p-4">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="size-4 text-brand" aria-hidden="true" />
                  Rating
                </dt>
                <dd className="mt-2 font-semibold">
                  {game.rating === null ? "No rating" : game.rating.toFixed(1)}
                </dd>
              </div>
            </dl>

            <div className="mt-8">
              <h2 className="font-heading text-2xl font-bold">
                More information
              </h2>

              <div className="mt-4 space-y-4 rounded-2xl bg-white p-6">
                <p>
                  <span className="font-semibold">Difficulty:</span>{" "}
                  {game.difficulty}
                </p>

                {game.instructions && (
                  <p className="whitespace-pre-line text-muted-foreground">
                    {game.instructions}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}