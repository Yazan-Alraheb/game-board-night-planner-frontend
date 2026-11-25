import type { ReactNode } from "react";
import { Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import GameImage from "@/components/recommendations/GameImage";
import MatchScore from "@/components/recommendations/MatchScore";
import OwnerList from "@/components/recommendations/OwnerList";
import { formatPlayerRange, formatPlaytime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Recommendation, RecommendationMode } from "@/types/recommendation";

interface RecommendationCardProps {
  recommendation: Recommendation;
  /** 1-based position in the backend's ranking. */
  rank: number;
  mode: RecommendationMode;
  /** "featured": large card for the top 3. "compact": row for the remaining results. */
  variant: "featured" | "compact";
  /** Optional action, e.g. "Add to game night". */
  action?: ReactNode;
}

function GameFacts({ recommendation }: { recommendation: Recommendation }) {
  const { minimum_players, maximum_players, playtime } = recommendation.game;
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <dt>
          <Users className="size-4 text-brand" aria-hidden="true" />
          <span className="sr-only">Players</span>
        </dt>
        <dd>{formatPlayerRange(minimum_players, maximum_players)}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>
          <Clock className="size-4 text-brand" aria-hidden="true" />
          <span className="sr-only">Play time</span>
        </dt>
        <dd>{formatPlaytime(playtime)}</dd>
      </div>
    </dl>
  );
}

function Categories({ categories }: { categories: string[] }) {
  if (categories.length === 0) return null;
  return (
    <ul aria-label="Categories" className="flex flex-wrap gap-1.5">
      {categories.map((category) => (
        <li key={category}>
          <Badge variant="outline" className="h-auto px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {category}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** One recommended game. Everything shown comes from the backend response. */
function RecommendationCard({ recommendation, rank, mode, variant, action }: RecommendationCardProps) {
  const { game, score, reason, owners } = recommendation;
  const headingId = `recommendation-${game.id}`;
  const featured = variant === "featured";

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "flex h-full overflow-hidden rounded-2xl border border-border bg-white shadow-sm",
        featured ? "flex-col" : "flex-col sm:flex-row",
        rank === 1 && "ring-2 ring-brand-strong/30",
      )}
    >
      <div className={cn("relative shrink-0", !featured && "sm:w-44")}>
        <GameImage
          gameId={game.id}
          name={game.name}
          imageUrl={game.image_url}
          className={featured ? "aspect-4/3" : "aspect-16/9 sm:aspect-auto sm:h-full sm:min-h-36"}
          placeholderClassName={featured ? "text-4xl" : "text-2xl"}
        />
        <span
          className={cn(
            "absolute top-3 left-3 flex items-center justify-center rounded-full font-bold shadow-sm",
            rank <= 3 ? "bg-cta text-cta-foreground" : "bg-white text-foreground",
            featured ? "size-10 text-sm" : "size-8 text-xs",
          )}
        >
          <span className="sr-only">Rank </span>#{rank}
        </span>
      </div>

      <div className={cn("flex flex-1 flex-col gap-3", featured ? "p-5" : "p-4 sm:p-5")}>
        <div className="space-y-2">
          <h3
            id={headingId}
            className={cn("font-heading font-bold tracking-tight break-words", featured ? "text-xl" : "text-lg")}
          >
            {game.name}
          </h3>
          <Categories categories={game.categories} />
          <GameFacts recommendation={recommendation} />
        </div>

        <MatchScore score={score} size={featured ? "default" : "sm"} />

        {reason.trim() !== "" && (
          <p className="text-sm leading-relaxed text-foreground/80">
            <span className="sr-only">Why we picked it: </span>
            {reason}
          </p>
        )}

        <OwnerList owners={owners} mode={mode} />

        {action && <div className="mt-auto pt-1">{action}</div>}
      </div>
    </article>
  );
}

export default RecommendationCard;
