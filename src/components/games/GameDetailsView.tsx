import Link from "next/link";
import { ArrowLeft, Clock, Star, Users } from "lucide-react";
import CollectionControls from "@/components/games/CollectionControls";
import {
  GameDetailsLoading,
  GameLoadError,
  GameNotFound,
} from "@/components/games/GameDetailsStates";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { GameCollectionView } from "@/hooks/useGameDetails";
import {
  formatPlayerRange,
  formatPlaytime,
  getInitials,
  placeholderColor,
} from "@/lib/format";
import { describeGameLoadError } from "@/lib/games/game-details";
import type { Resource } from "@/lib/game-nights/night-resource";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { CollectionStatus } from "@/types/collection";
import type { Game } from "@/types/game";

export interface GameDetailsViewProps {
  /** null when the route id can't be a game id. */
  game: Resource<Game> | null;
  collection: GameCollectionView;
  onRetryGame: () => void;
  onSave: (status: CollectionStatus) => void;
  onRemove: () => void;
  onRetryCollection: () => void;
}

/** Everything the Game Details page renders, driven only by props. */
export default function GameDetailsView({
  game: resource,
  collection,
  onRetryGame,
  onSave,
  onRemove,
  onRetryCollection,
}: GameDetailsViewProps) {
  if (resource === null) return <GameNotFound />;
  if (resource.status === "loading") return <GameDetailsLoading />;
  if (resource.status === "error") {
    const failure = describeGameLoadError(resource.error);
    return failure.kind === "not_found" ? (
      <GameNotFound />
    ) : (
      <GameLoadError message={failure.message} onRetry={onRetryGame} />
    );
  }

  const game = resource.data;

  return (
    <div className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={ROUTES.browse}
          className="inline-flex items-center gap-2 text-brand-strong"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
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
                  aria-hidden="true"
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

            <h1 className="mt-4 text-4xl font-bold">{game.name}</h1>

            {game.description && (
              <p className="mt-5 text-lg text-muted-foreground">
                {game.description}
              </p>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4 text-brand" aria-hidden="true" />
                  Players
                </p>
                <p className="mt-2 font-semibold">
                  {formatPlayerRange(game.minimum_players, game.maximum_players)}
                </p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4 text-brand" aria-hidden="true" />
                  Play time
                </p>
                <p className="mt-2 font-semibold">{formatPlaytime(game.playtime)}</p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="size-4 text-brand" aria-hidden="true" />
                  Rating
                </p>
                <p className="mt-2 font-semibold">
                  {game.rating === null ? "No rating" : game.rating.toFixed(1)}
                </p>
              </div>
            </div>

            <CollectionControls
              collection={collection}
              onSave={onSave}
              onRemove={onRemove}
              onRetry={onRetryCollection}
            />

            <div className="mt-8 rounded-2xl bg-white p-6">
              <h2 className="text-2xl font-bold">More information</h2>

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
