import Link from "next/link";
import { Clock, Gauge, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import GameImage from "@/components/recommendations/GameImage";
import { RetryButton } from "@/components/game-nights/details/AttendeesSection";
import type { Resource } from "@/hooks/useGameNightDetails";
import { formatPlayerRange, formatPlaytime } from "@/lib/format";
import { splitGames } from "@/lib/game-nights/details";
import { ROUTES } from "@/lib/routes";
import type { GameNightAvailableGame } from "@/types/game-night";

interface SelectedGamesSectionProps {
  games: Resource<GameNightAvailableGame[]>;
  canManage: boolean;
  /** Game ids with an add/remove request in flight. */
  pendingGameIds: ReadonlySet<number>;
  onSelect: (game: GameNightAvailableGame, selected: boolean) => void;
  onRetry: () => void;
}

function GameFacts({ entry }: { entry: GameNightAvailableGame }) {
  const { game } = entry;
  return (
    <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <dt>
          <Users className="size-4 text-brand" aria-hidden="true" />
          <span className="sr-only">Players</span>
        </dt>
        <dd>{formatPlayerRange(game.minimum_players, game.maximum_players)}</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt>
          <Clock className="size-4 text-brand" aria-hidden="true" />
          <span className="sr-only">Play time</span>
        </dt>
        <dd>{formatPlaytime(game.playtime)}</dd>
      </div>
      {game.difficulty && (
        <div className="flex items-center gap-1">
          <dt>
            <Gauge className="size-4 text-brand" aria-hidden="true" />
            <span className="sr-only">Difficulty</span>
          </dt>
          <dd>{game.difficulty}</dd>
        </div>
      )}
    </dl>
  );
}

function owners(entry: GameNightAvailableGame): string | null {
  if (entry.owners.length === 0) return null;
  return `Owned by ${entry.owners.map((owner) => owner.name).join(", ")}`;
}

function GameRow({
  entry,
  canManage,
  pending,
  onSelect,
}: {
  entry: GameNightAvailableGame;
  canManage: boolean;
  pending: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const { game, selected } = entry;
  const ownerText = owners(entry);

  return (
    <li className="flex gap-4 rounded-2xl border bg-white p-3">
      <GameImage
        gameId={game.id}
        name={game.name}
        imageUrl={game.image_url}
        className="size-20 shrink-0 rounded-xl border sm:size-24"
        placeholderClassName="text-2xl"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-heading text-lg leading-snug font-bold break-words">{game.name}</h3>
        <GameFacts entry={entry} />
        {ownerText && <p className="mt-1 text-sm break-words text-muted-foreground">{ownerText}</p>}
        {canManage && (
          <div className="mt-auto flex justify-end pt-2">
            <button
              type="button"
              onClick={() => onSelect(!selected)}
              disabled={pending}
              className={
                selected
                  ? "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/30 focus-visible:outline-none disabled:opacity-50"
                  : "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
              }
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : selected ? (
                <Trash2 className="size-4" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {selected ? "Remove" : "Add to game night"}
              <span className="sr-only"> {game.name}</span>
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The games chosen for the night (GET /api/game-nights/{id}/games, `selected: true`).
 * Other games accepted attendees own are shown separately, collapsed, as candidates.
 */
function SelectedGamesSection({ games, canManage, pendingGameIds, onSelect, onRetry }: SelectedGamesSectionProps) {
  return (
    <Card className="gap-0 rounded-2xl p-6 text-base sm:p-8">
      <section aria-labelledby="games-heading">
        <h2 id="games-heading" className="font-heading text-2xl font-bold">
          Selected games
        </h2>
        <div className="mt-4">
          <GamesBody games={games} canManage={canManage} pendingGameIds={pendingGameIds} onSelect={onSelect} onRetry={onRetry} />
        </div>
      </section>
    </Card>
  );
}

function GamesBody({ games, canManage, pendingGameIds, onSelect, onRetry }: SelectedGamesSectionProps) {
  if (games.status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Loading games…</span>
        <div aria-hidden="true" className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (games.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <p role="alert" className="text-foreground/80">
          Couldn&apos;t load the games for this game night.
        </p>
        <RetryButton onClick={onRetry} label="loading games" />
      </div>
    );
  }

  const { selected, available } = splitGames(games.data);

  return (
    <>
      {selected.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed px-6 py-8 text-center">
          <p className="font-semibold">No games selected yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? available.length > 0
                ? "Pick from your attendees' collections below, or get suggestions."
                : "Games your accepted attendees own will show up here to choose from."
              : "The host hasn't picked any games yet."}
          </p>
          {canManage && (
            <Link
              href={ROUTES.findGame}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Find a game
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" aria-label="Selected games">
          {selected.map((entry) => (
            <GameRow
              key={entry.game.id}
              entry={entry}
              canManage={canManage}
              pending={pendingGameIds.has(entry.game.id)}
              onSelect={(value) => onSelect(entry, value)}
            />
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <details className="group mt-6 rounded-2xl bg-surface-warm/70 p-4">
          <summary className="cursor-pointer rounded-lg font-semibold text-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            Also in attendees&apos; collections ({available.length})
            <span className="block text-sm font-normal text-muted-foreground">
              Not selected for this night{canManage ? ". Add any of them to the plan." : "."}
            </span>
          </summary>
          <ul className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Other games attendees own">
            {available.map((entry) => (
              <GameRow
                key={entry.game.id}
                entry={entry}
                canManage={canManage}
                pending={pendingGameIds.has(entry.game.id)}
                onSelect={(value) => onSelect(entry, value)}
              />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export default SelectedGamesSection;
