"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarPlus, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import ChoiceCard from "@/components/find-a-game/ChoiceCard";
import FieldError from "@/components/find-a-game/FieldError";
import type { LazyResource } from "@/hooks/useLazyResource";
import type { ApiErrorInfo } from "@/api/errors";
import { formatEventDate } from "@/lib/format";
import { isPastGameNight, sortGameNights } from "@/lib/find-game/game-nights";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { GameNightResponse } from "@/types/game-night";

interface GameNightPickerProps {
  gameNights: LazyResource<GameNightResponse[]>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRetry: () => void;
  currentUserId: number;
  error?: string;
}

function loadErrorMessage(error: ApiErrorInfo): string {
  switch (error.kind) {
    case "unauthorized":
      return "Your session has expired. Please log in again.";
    case "forbidden":
      return "You don't have access to these game nights.";
    case "network":
      return "Couldn't reach the server. Check your connection and try again.";
    default:
      return "Something went wrong while loading your game nights.";
  }
}

/** Choose one of the current user's existing game nights (from GET /api/game-nights). */
function GameNightPicker({
  gameNights,
  selectedId,
  onSelect,
  onRetry,
  currentUserId,
  error,
}: GameNightPickerProps) {
  const errorId = "game-night-error";
  const hintId = "game-night-hint";
  // Read the clock once per mount so sorting and "Past" labels stay stable between renders.
  const [now] = useState(() => Date.now());

  return (
    <fieldset aria-describedby={`${hintId} ${errorId}`}>
      <legend className="font-heading text-lg font-bold">Which game night?</legend>
      <p id={hintId} className="mt-1 text-sm text-muted-foreground">
        We&apos;ll combine the games owned by the host and everyone who has accepted. Pending
        invites and wishlist games aren&apos;t included, and the player count is based on who&apos;s
        coming.
      </p>

      <div className="mt-4">
        {(gameNights.status === "idle" || gameNights.status === "loading") && (
          <div role="status" aria-label="Loading your game nights" className="grid gap-3">
            {[0, 1].map((index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-stone-200/60" />
            ))}
          </div>
        )}

        {gameNights.status === "error" && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-medium text-destructive">{loadErrorMessage(gameNights.error)}</p>
            {gameNights.error.kind !== "unauthorized" && (
              <Button type="button" variant="outline" onClick={onRetry} className="mt-3 h-10 rounded-xl px-4">
                Try again
              </Button>
            )}
          </div>
        )}

        {gameNights.status === "success" && gameNights.data.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center">
            <CalendarPlus className="size-10 text-brand" aria-hidden="true" />
            <p className="mt-3 font-semibold">You don&apos;t have any game nights yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create one and invite friends, or find games from your own collection instead.
            </p>
            <Link
              href={ROUTES.createGameNight}
              className={cn(
                buttonVariants(),
                "mt-4 h-11 rounded-xl bg-brand-strong px-5 text-base font-semibold text-brand-foreground hover:bg-brand",
              )}
            >
              Create Game Night
            </Link>
          </div>
        )}

        {gameNights.status === "success" && gameNights.data.length > 0 && (
          <div className="grid gap-3">
            {sortGameNights(gameNights.data, now).map((gameNight) => {
              const isHost = gameNight.host_id === currentUserId;
              const isPast = isPastGameNight(gameNight, now);
              return (
                <ChoiceCard
                  key={gameNight.id}
                  name="game-night"
                  value={String(gameNight.id)}
                  checked={selectedId === gameNight.id}
                  onSelect={() => onSelect(gameNight.id)}
                  describedBy={errorId}
                  label={<span className="break-words">{gameNight.name}</span>}
                  hint={
                    <span className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-4 shrink-0 text-brand" aria-hidden="true" />
                        <time dateTime={gameNight.starts_at}>{formatEventDate(gameNight.starts_at)}</time>
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="size-4 shrink-0 text-cta" aria-hidden="true" />
                        <span className="sr-only">Location: </span>
                        <span className="break-words">{gameNight.location}</span>
                      </span>
                    </span>
                  }
                  aside={
                    <span className="flex shrink-0 flex-col items-end gap-1 self-start">
                      <Badge
                        className={cn(
                          "h-auto px-2.5 py-0.5 text-xs font-medium text-brand-strong",
                          // The selected card is already brand-soft, so the badge switches to
                          // white with a border to stay visible.
                          selectedId === gameNight.id
                            ? "border-brand-strong/30 bg-white"
                            : "bg-brand-soft",
                        )}
                      >
                        {isHost ? "Hosting" : "Guest"}
                      </Badge>
                      {isPast && (
                        <Badge variant="outline" className="h-auto px-2.5 py-0.5 text-xs text-muted-foreground">
                          Past
                        </Badge>
                      )}
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

export default GameNightPicker;
