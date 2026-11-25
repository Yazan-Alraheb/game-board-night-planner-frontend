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

  // Use the placeholder if the image does not load.
  const [imageError, setImageError] = useState(false);

  const showImage = image_url && !imageError;

  return (
    <Link href={`/games/${id}`} className="block h-full">
      <Card className="h-full gap-0 rounded-2xl py-0">
        <div className="relative aspect-4/3 bg-white">
          {showImage ? (
            <img
              src={image_url}
              alt={name}
              loading="lazy"
              onError={() => setImageError(true)}
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

          {owned && (
            <Badge className="absolute right-3 top-3 h-auto bg-brand-strong px-3 py-1 text-sm font-medium text-brand-foreground">
              Owned
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <h3 className="font-heading text-lg font-bold tracking-tight">
            {name}
          </h3>

          {categories.length > 0 && (
            <p className="text-muted-foreground">
              {categories[0]}
            </p>
          )}

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