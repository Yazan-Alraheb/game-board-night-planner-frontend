"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarPlus, LogIn, Plus, RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import GameNightCard from "@/components/home/GameNightCard";
import SectionHeader from "@/components/home/SectionHeader";
import { useAuth } from "@/auth/useAuth";
import { HOMEPAGE_GAME_NIGHT_LIMIT, useUpcomingGameNights } from "@/hooks/useUpcomingGameNights";
import { getGameNightRole } from "@/lib/home/upcoming-game-nights";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const GRID_CLASSES = "grid gap-6 md:grid-cols-2";

const PRIMARY_ACTION_CLASSES =
  "h-11 rounded-xl bg-brand-strong px-5 text-base font-semibold text-brand-foreground hover:bg-brand";

function GameNightCardSkeleton() {
  return (
    <Card className="gap-0 rounded-2xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mt-3 h-5 w-2/5 animate-pulse rounded bg-muted" />
      <div className="mt-5 flex items-center gap-3">
        <div className="flex -space-x-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="size-10 animate-pulse rounded-full bg-muted ring-2 ring-background" />
          ))}
        </div>
        <div className="h-5 w-16 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-5 h-5 w-3/5 animate-pulse rounded bg-muted" />
    </Card>
  );
}

/** Dashed panel used for the empty and signed-out states. */
function EmptyPanel({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-brand/30 bg-white px-6 py-10 text-center sm:py-12">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
        <CalendarPlus className="size-7" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h3 className="font-heading text-xl font-bold tracking-tight">{title}</h3>
        <p className="mx-auto max-w-md text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  );
}

function UpcomingGameNightsSection() {
  const { session } = useAuth();
  const [state, retry] = useUpcomingGameNights();

  return (
    <section aria-labelledby="upcoming-heading" aria-busy={state.status === "loading"}>
      <SectionHeader
        id="upcoming-heading"
        title="Upcoming Game Nights"
        action={{
          to: ROUTES.createGameNight,
          label: (
            <>
              <Plus className="size-4" aria-hidden="true" />
              Create New
            </>
          ),
        }}
      />

      {state.status === "loading" && (
        <>
          <p role="status" className="sr-only">
            Loading your game nights…
          </p>
          <ul className={GRID_CLASSES} aria-hidden="true">
            {Array.from({ length: HOMEPAGE_GAME_NIGHT_LIMIT }, (_, index) => (
              <li key={index} className="grid">
                <GameNightCardSkeleton />
              </li>
            ))}
          </ul>
        </>
      )}

      {state.status === "signed-out" && (
        <EmptyPanel
          title="Your game nights, all in one place"
          action={
            <Link
              href={`${ROUTES.login}?next=${encodeURIComponent(ROUTES.home)}`}
              className={cn(buttonVariants(), PRIMARY_ACTION_CLASSES)}
            >
              <LogIn aria-hidden="true" />
              Log In
            </Link>
          }
        >
          Log in to see the game nights you&apos;re hosting or invited to.
        </EmptyPanel>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          className="flex flex-col items-start gap-4 rounded-2xl border border-destructive/20 bg-white p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-base">
            We couldn&apos;t load your game nights right now. Please check your connection and try
            again.
          </p>
          <Button variant="outline" onClick={retry} className="h-10 shrink-0 rounded-xl px-4 text-base">
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}

      {state.status === "success" &&
        session &&
        (state.data.shown.length > 0 ? (
          <>
            <ul className={GRID_CLASSES}>
              {state.data.shown.map(({ gameNight, members }) => (
                <li key={gameNight.id} className="grid">
                  <GameNightCard
                    gameNight={gameNight}
                    members={members}
                    role={getGameNightRole(gameNight, session.user.id, members)}
                  />
                </li>
              ))}
            </ul>
            {state.data.totalUpcoming > state.data.shown.length && (
              <p className="mt-4 text-muted-foreground">
                +{state.data.totalUpcoming - state.data.shown.length} more upcoming{" "}
                {state.data.totalUpcoming - state.data.shown.length === 1 ? "game night" : "game nights"}
              </p>
            )}
          </>
        ) : (
          <EmptyPanel
            title="No upcoming game nights"
            action={
              <Link href={ROUTES.createGameNight} className={cn(buttonVariants(), PRIMARY_ACTION_CLASSES)}>
                <Plus aria-hidden="true" />
                Create Game Night
              </Link>
            }
          >
            Pick a date, choose a game and invite your friends. Your next game night is a few
            clicks away.
          </EmptyPanel>
        ))}
    </section>
  );
}

export default UpcomingGameNightsSection;
