import Link from "next/link";
import { useState } from "react";
import { Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatPlayerRange,
  formatPlaytime,
  getInitials,
  placeholderColor,
} from "@/lib/format";
import type { Game } from "@/types/game";

interface GameCardProps {
  game: Game;
  /** Whether the game is in the current user's collection. */
  owned?: boolean;
}

function GameCard({ game, owned = false }: GameCardProps) {
  const {
    id,
    name,
    categories,
    minimum_players,
    maximum_players,
    playtime,
    image_url,
  } = game;

  // Stores the image URL if loading it fails.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  // Only display the image if it exists and has not failed.
  const showImage =
    image_url !== null && image_url !== failedImageUrl;

  return (
    // Makes the entire card clickable.
    <Link
      href={`/games/${id}`}
      className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      aria-label={`View details for ${name}`}
    >
      <Card className="h-full gap-0 rounded-2xl py-0 transition hover:-translate-y-1 hover:shadow-lg">
        {/* Game image or fallback initials. */}
        <div className="relative aspect-4/3 bg-white">
          {showImage ? (
            <img
              src={image_url}
              alt=""
              loading="lazy"
              onError={() => setFailedImageUrl(image_url)}
              className="absolute inset-0 size-full object-contain p-3"
            />
          ) : (
            <div
              aria-hidden="true"
              className={`flex size-full items-center justify-center font-heading text-4xl font-bold ${placeholderColor(id)}`}
            >
              {getInitials(name)}
            </div>
          )}

          {/* Shows the Owned badge when needed. */}
          {owned && (
            <Badge className="absolute top-3 right-3 h-auto bg-brand-strong px-3 py-1 text-sm font-medium text-brand-foreground">
              Owned
            </Badge>
          )}
        </div>

        {/* Game information. */}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <h3 className="font-heading text-lg font-bold tracking-tight">
            {name}
          </h3>

          {/* Shows the first game category. */}
          {categories.length > 0 && (
            <p className="text-muted-foreground">
              {categories[0]}
            </p>
          )}

          {/* Shows player count and playtime. */}
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <dt>
                <Users
                  className="size-4 text-brand"
                  aria-hidden="true"
                />
                <span className="sr-only">Players</span>
              </dt>

              <dd>
                {formatPlayerRange(
                  minimum_players,
                  maximum_players,
                )}
              </dd>
            </div>

            <div className="flex items-center gap-1.5">
              <dt>
                <Clock
                  className="size-4 text-brand"
                  aria-hidden="true"
                />
                <span className="sr-only">Play time</span>
              </dt>

              <dd>{formatPlaytime(playtime)}</dd>
            </div>
          </dl>
        </div>
      </Card>
    </Link>
  );
}

export default GameCard;