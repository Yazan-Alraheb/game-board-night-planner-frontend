import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList, SearchX } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ApiErrorInfo } from "@/api/errors";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { RecommendationMode } from "@/types/recommendation";

const primaryButton =
  "h-11 rounded-xl bg-brand-strong px-5 text-base font-semibold text-brand-foreground hover:bg-brand";
const outlineButton = "h-11 rounded-xl bg-white px-5 text-base";

interface StatePanelProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  role?: "alert" | "status";
}

function StatePanel({ icon, title, children, actions, role }: StatePanelProps) {
  return (
    <section
      role={role}
      className="flex flex-col items-center rounded-2xl border border-border bg-white px-5 py-10 text-center shadow-sm sm:px-10"
    >
      {icon}
      <h2 className="mt-4 font-heading text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      <div className="mt-2 max-w-xl text-muted-foreground">{children}</div>
      <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">{actions}</div>
    </section>
  );
}

/** Placeholder cards while recommendations load. */
export function LoadingResults() {
  return (
    <div>
      <p role="status" className="sr-only">
        Finding the best games for you…
      </p>
      <div aria-hidden="true" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="aspect-4/3 animate-pulse bg-stone-200/70" />
            <div className="space-y-3 p-5">
              <div className="h-5 w-2/3 animate-pulse rounded bg-stone-200/70" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200/70" />
              <div className="h-2 w-full animate-pulse rounded bg-stone-200/70" />
              <div className="h-12 w-full animate-pulse rounded bg-stone-200/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** No submitted answers (results opened directly, or answers from another account or version). */
export function NoRequestState({ reason }: { reason: "missing" | "stale" | "invalid" }) {
  return (
    <StatePanel
      icon={<ClipboardList className="size-12 text-brand" aria-hidden="true" />}
      title={reason === "missing" ? "Answer a few questions first" : "Your answers have expired"}
      actions={
        <Link href={ROUTES.findGame} className={cn(buttonVariants(), primaryButton)}>
          Find a Game
        </Link>
      }
    >
      <p>
        {reason === "missing"
          ? "We need to know who's playing and how long you have before we can recommend games."
          : "We couldn't use your previous answers. Please go through the questions again."}
      </p>
    </StatePanel>
  );
}

interface ErrorContent {
  title: string;
  message: string;
  /** Whether trying the same request again can help. */
  retryable: boolean;
}

function errorContent(error: ApiErrorInfo, mode: RecommendationMode): ErrorContent {
  switch (error.kind) {
    case "unauthorized":
      return {
        title: "Please log in again",
        message: "Your session has expired. After logging in, you'll come back to your recommendations.",
        retryable: false,
      };
    case "forbidden":
      return {
        title: "You can't get recommendations for this game night",
        message:
          "Only the host and guests who have accepted the invitation can get recommendations for it. If you've been invited, accept the invitation first, or choose a different game night.",
        retryable: false,
      };
    case "not_found":
      return {
        title: mode === "game_night" ? "Game night not found" : "Not found",
        message:
          mode === "game_night"
            ? "This game night no longer exists. Please choose another one."
            : "Something you selected no longer exists. Please review your answers.",
        retryable: false,
      };
    case "bad_request":
    case "validation":
      return {
        title: "Some answers need another look",
        message: "The server couldn't use some of your answers. Please review them and try again.",
        retryable: false,
      };
    case "network":
      return {
        title: "Couldn't reach the server",
        message: "Check your connection and try again.",
        retryable: true,
      };
    default:
      return {
        title: "Something went wrong",
        message: "We couldn't load your recommendations right now. Please try again.",
        retryable: true,
      };
  }
}

interface ResultsErrorProps {
  error: ApiErrorInfo;
  mode: RecommendationMode;
  onRetry: () => void;
  onEdit: () => void;
}

/** A failed request. Never replaced by fallback results. */
export function ResultsError({ error, mode, onRetry, onEdit }: ResultsErrorProps) {
  const content = errorContent(error, mode);

  return (
    <StatePanel
      role="alert"
      icon={<AlertTriangle className="size-12 text-cta" aria-hidden="true" />}
      title={content.title}
      actions={
        <>
          {content.retryable && (
            <Button type="button" onClick={onRetry} className={primaryButton}>
              Try again
            </Button>
          )}
          {error.kind === "unauthorized" ? (
            <Link
              href={`${ROUTES.login}?next=${encodeURIComponent(ROUTES.recommendations)}`}
              className={cn(buttonVariants(), primaryButton)}
            >
              Log in
            </Link>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onEdit}
              className={content.retryable ? outlineButton : primaryButton}
            >
              Edit answers
            </Button>
          )}
        </>
      }
    >
      <p>{content.message}</p>
    </StatePanel>
  );
}

interface NoMatchesProps {
  mode: RecommendationMode;
  onEdit: () => void;
}

/** A successful request with an empty list. A valid result, not an error. */
export function NoMatches({ mode, onEdit }: NoMatchesProps) {
  return (
    <StatePanel
      role="status"
      icon={<SearchX className="size-12 text-brand" aria-hidden="true" />}
      title="No matching games found"
      actions={
        <>
          <Button type="button" onClick={onEdit} className={primaryButton}>
            Edit answers
          </Button>
          <Link href={ROUTES.collection} className={cn(buttonVariants({ variant: "outline" }), outlineButton)}>
            My Collection
          </Link>
        </>
      }
    >
      <p>
        {mode === "personal"
          ? "None of the games you own fit your player count and play time, or your collection is still empty."
          : "None of the games owned by the host and accepted guests fit this game night's player count and your play time, or nobody has added games yet."}
      </p>
      <p className="mt-2">
        Try a longer play time or a different number of players, or add games to your collection.
      </p>
    </StatePanel>
  );
}
