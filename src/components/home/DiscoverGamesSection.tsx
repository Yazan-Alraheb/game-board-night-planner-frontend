"use client";
import { useEffect, useState } from "react";
import { ArrowRight, RotateCw } from "lucide-react";
import { getApiErrorInfo } from "@/api/errors";
import { useOwnedGameIds } from "@/hooks/useOwnedGameIds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import GameCard from "@/components/home/GameCard";
import SectionHeader from "@/components/home/SectionHeader";
import { getGames } from "@/api/games";
import { ROUTES } from "@/lib/routes";
import type { Game } from "@/types/game";

/** One row on desktop (lg:grid-cols-5). */
const HOMEPAGE_GAME_LIMIT = 5;

const GRID_CLASSES = "grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; games: Game[] };

function GameCardSkeleton() {
  return (
    <Card className="gap-0 rounded-2xl py-0">
      <div className="aspect-4/3 animate-pulse bg-muted" />
      <div className="space-y-2 p-4 sm:p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  );
}

function DiscoverGamesSection() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  // Loaded separately so the public games list never waits for, or fails because of, the collection.
  const ownedGameIds = useOwnedGameIds();

  useEffect(() => {
    const controller = new AbortController();

    getGames({ limit: HOMEPAGE_GAME_LIMIT }, controller.signal)
      .then((data) => setState({ status: "success", games: data.games }))
      .catch((error: unknown) => {
        const info = getApiErrorInfo(error);
        if (info.kind === "canceled") return; // Component unmounted or retried.
        // Log only status/kind: the Axios error's config holds the Authorization header.
        console.error("Failed to load games", info.kind, info.status);
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, [reloadKey]);

  const retry = () => {
    setState({ status: "loading" });
    setReloadKey((key) => key + 1);
  };

  return (
    <section aria-labelledby="discover-heading" aria-busy={state.status === "loading"}>
      <SectionHeader
        id="discover-heading"
        title="Discover Games"
        action={{
          to: ROUTES.browse,
          label: (
            <>
              View All
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          ),
        }}
      />

      {state.status === "loading" && (
        <>
          <p role="status" className="sr-only">
            Loading games…
          </p>
          <ul className={GRID_CLASSES} aria-hidden="true">
            {Array.from({ length: HOMEPAGE_GAME_LIMIT }, (_, index) => (
              <li key={index} className="grid">
                <GameCardSkeleton />
              </li>
            ))}
          </ul>
        </>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          className="flex flex-col items-start gap-4 rounded-2xl border border-destructive/20 bg-white p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-base">
            We couldn&apos;t load games right now. Please check your connection and try again.
          </p>
          <Button variant="outline" onClick={retry} className="h-10 shrink-0 rounded-xl px-4 text-base">
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}

      {state.status === "success" &&
        (state.games.length > 0 ? (
          <ul className={GRID_CLASSES}>
            {state.games.map((game) => (
              <li key={game.id} className="grid">
                <GameCard game={game} owned={ownedGameIds?.has(game.id) ?? false} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-6 text-muted-foreground">No games available yet.</p>
        ))}
    </section>
  );
}

export default DiscoverGamesSection;
