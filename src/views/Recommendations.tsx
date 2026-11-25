"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Info, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import AddToGameNightButton from "@/components/recommendations/AddToGameNightButton";
import AnswersSummary from "@/components/recommendations/AnswersSummary";
import RecommendationCard from "@/components/recommendations/RecommendationCard";
import {
  LoadingResults,
  NoMatches,
  NoRequestState,
  ResultsError,
} from "@/components/recommendations/ResultsStates";
import { useAuth } from "@/auth/useAuth";
import { getGameNight } from "@/api/game-nights";
import { useAddToGameNight, type SelectedGamesStatus } from "@/hooks/useAddToGameNight";
import {
  resolveAddControlsAccess,
  type AddControlsAccess,
} from "@/lib/recommendations/add-to-game-night";
import { useLazyResource } from "@/hooks/useLazyResource";
import { useRecommendations } from "@/hooks/useRecommendations";
import {
  draftDiffersFromRequest,
  prepareDraftForEditing,
  startOver,
} from "@/lib/recommendations/handoff";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Recommendation, RecommendationMode } from "@/types/recommendation";

/** How many results get the large "top pick" card. */
const FEATURED_COUNT = 3;

interface ResultsProps {
  userId: number;
}

function Results({ userId }: ResultsProps) {
  const router = useRouter();
  const { state, retry } = useRecommendations(userId);

  const snapshot = state.status === "no-request" ? null : state.snapshot;
  const request = snapshot?.request ?? null;
  const mode: RecommendationMode | null = request?.mode ?? null;
  const gameNightId = request?.mode === "game_night" ? request.game_night_id : null;

  // Event details: name and date for the summary, and host_id to decide who sees Add controls.
  const fetchGameNight = useCallback(
    (signal: AbortSignal) => getGameNight(gameNightId ?? 0, signal),
    [gameNightId],
  );
  const [gameNight, retryGameNight] = useLazyResource(fetchGameNight, gameNightId !== null);

  // The backend only lets the host add games, so only the host gets Add controls.
  // Guests, and users whose host status isn't known yet, get none (and no extra requests).
  // Each add is still authorized by the backend.
  const addAccess = resolveAddControlsAccess(gameNight, userId);
  const canShowAdd = mode === "game_night" && state.status === "success" && addAccess.kind === "host";
  const addToGameNight = useAddToGameNight(canShowAdd ? gameNightId : null);

  // Checked once: did the user edit the questionnaire after these results were requested?
  const [answersChanged] = useState(() => (request ? draftDiffersFromRequest(userId, request) : false));

  function handleEdit() {
    if (request) prepareDraftForEditing(userId, request);
    router.push(ROUTES.findGame);
  }

  function handleStartOver() {
    startOver();
    router.push(ROUTES.findGame);
  }

  const hasResults = state.status === "success" && state.recommendations.length > 0;

  return (
    <div className="bg-surface-warm">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {hasResults ? "Here are your top picks!" : "Your recommendations"}
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            {hasResults
              ? mode === "game_night"
                ? "Based on your answers and everyone's games, we think your group will love these."
                : "Based on your answers, we think you'll love these games."
              : "Games picked for your group, based on your answers."}
          </p>
        </header>

        {answersChanged && (
          <div
            role="status"
            className="mx-auto mt-6 flex max-w-3xl flex-col items-start gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="flex items-start gap-2 text-brand-strong">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              You&apos;ve changed your answers since these results were made.
            </p>
            <Link
              href={ROUTES.findGame}
              className="shrink-0 font-semibold text-brand-strong underline underline-offset-4"
            >
              Get updated recommendations
            </Link>
          </div>
        )}

        <div className="mt-8 space-y-8 sm:mt-10">
          {state.status === "no-request" && <NoRequestState reason={state.reason} />}

          {state.status === "loading" && <LoadingResults />}

          {state.status === "error" && mode && (
            <ResultsError error={state.error} mode={mode} onRetry={retry} onEdit={handleEdit} />
          )}

          {state.status === "success" && mode && state.recommendations.length === 0 && (
            <NoMatches mode={mode} onEdit={handleEdit} />
          )}

          {state.status === "success" && mode && state.recommendations.length > 0 && (
            <>
              <p role="status" className="sr-only">
                {state.recommendations.length === 1
                  ? "1 game recommended."
                  : `${state.recommendations.length} games recommended, best match first.`}
              </p>

              {mode === "game_night" && (
                <AddAccessNotice
                  access={addAccess}
                  onRetryHost={retryGameNight}
                  selectedStatus={canShowAdd ? addToGameNight.selectedStatus : null}
                  onRetrySelected={addToGameNight.retrySelected}
                  eventError={canShowAdd ? addToGameNight.eventError : null}
                />
              )}

              <RecommendationList
                recommendations={state.recommendations}
                mode={mode}
                renderAction={
                  canShowAdd
                    ? (recommendation) => (
                        <AddToGameNightButton
                          gameName={recommendation.game.name}
                          status={addToGameNight.statusFor(recommendation.game.id)}
                          disabled={addToGameNight.eventError !== null}
                          onAdd={() => void addToGameNight.add(recommendation.game.id)}
                        />
                      )
                    : undefined
                }
              />
            </>
          )}

          {request && (
            <AnswersSummary
              request={request}
              gameNight={gameNight.status === "success" ? gameNight.data : null}
              onEdit={handleEdit}
            />
          )}

          <nav aria-label="Next steps" className="flex flex-col-reverse justify-center gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleStartOver}
              className="h-12 rounded-xl bg-white px-6 text-base"
            >
              <RotateCcw aria-hidden="true" />
              Start Over
            </Button>
            <Link
              href={ROUTES.browse}
              className={cn(
                buttonVariants(),
                "h-12 rounded-xl bg-brand-strong px-6 text-base font-bold text-brand-foreground hover:bg-brand",
              )}
            >
              Browse All Games
              <ArrowRight aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

interface AddAccessNoticeProps {
  access: AddControlsAccess;
  onRetryHost: () => void;
  /** null when Add controls aren't shown. */
  selectedStatus: SelectedGamesStatus | null;
  onRetrySelected: () => void;
  eventError: string | null;
}

/** Explains why Add controls are missing, loading or blocked. Shows nothing when adding works. */
function AddAccessNotice({ access, onRetryHost, selectedStatus, onRetrySelected, eventError }: AddAccessNoticeProps) {
  const info = "flex items-start gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted-foreground";
  const problem =
    "flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between";
  const retryButton = "h-9 shrink-0 rounded-lg bg-white px-3 text-foreground";

  if (access.kind === "guest") {
    return (
      <p className={info}>
        <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        Only the host can add games to this game night.
      </p>
    );
  }

  if (access.kind === "unknown") {
    return (
      <div role="alert" className={problem}>
        <p>Couldn&apos;t load this game night&apos;s details, so adding games isn&apos;t available right now.</p>
        <Button type="button" variant="outline" onClick={onRetryHost} className={retryButton}>
          Try again
        </Button>
      </div>
    );
  }

  if (eventError) {
    return (
      <p role="alert" className={problem}>
        {eventError}
      </p>
    );
  }

  if (selectedStatus === "error") {
    return (
      <div role="alert" className={problem}>
        <p>Couldn&apos;t check which games are already in this game night, so adding is paused.</p>
        <Button type="button" variant="outline" onClick={onRetrySelected} className={retryButton}>
          Try again
        </Button>
      </div>
    );
  }

  // "checking" (host unknown yet) and the host's own loading state need no banner:
  // the buttons show "Checking game night…" and guests never see a flash of controls.
  return null;
}

interface RecommendationListProps {
  recommendations: Recommendation[];
  mode: RecommendationMode;
  renderAction?: (recommendation: Recommendation) => ReactNode;
}

/** Results in the backend's exact order: the top picks as large cards, the rest as compact rows. */
function RecommendationList({ recommendations, mode, renderAction }: RecommendationListProps) {
  const featured = recommendations.slice(0, FEATURED_COUNT);
  const more = recommendations.slice(FEATURED_COUNT);

  return (
    <div className="space-y-10">
      <section aria-labelledby="top-picks-heading">
        <h2 id="top-picks-heading" className="sr-only">
          Top picks
        </h2>
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((recommendation, index) => (
            <li key={recommendation.game.id} className="grid">
              <RecommendationCard
                recommendation={recommendation}
                rank={index + 1}
                mode={mode}
                variant="featured"
                action={renderAction?.(recommendation)}
              />
            </li>
          ))}
        </ol>
      </section>

      {more.length > 0 && (
        <section aria-labelledby="more-matches-heading">
          <h2 id="more-matches-heading" className="font-heading text-xl font-bold tracking-tight">
            More matches
          </h2>
          <ol start={FEATURED_COUNT + 1} className="mt-4 grid gap-4 lg:grid-cols-2">
            {more.map((recommendation, index) => (
              <li key={recommendation.game.id} className="grid">
                <RecommendationCard
                  recommendation={recommendation}
                  rank={FEATURED_COUNT + index + 1}
                  mode={mode}
                  variant="compact"
                  action={renderAction?.(recommendation)}
                />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/** Recommendations page. Rendered inside the (protected) layout, so a session exists. */
function Recommendations() {
  const { session } = useAuth();
  if (!session) return null;

  const userId = session.user.id;
  // Keyed by user so another account in the same tab never sees these results.
  return <Results key={userId} userId={userId} />;
}

export default Recommendations;
