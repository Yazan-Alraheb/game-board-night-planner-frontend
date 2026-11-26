import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const BACK_LINK =
  "mt-6 inline-block rounded-lg bg-brand-strong px-5 py-3 text-white";

export function GameDetailsLoading() {
  return (
    <p role="status" className="p-12 text-center">
      Loading game…
    </p>
  );
}

/** Only for a real 404 (or an id that can't exist). */
export function GameNotFound() {
  return (
    <div className="mx-auto max-w-xl p-12 text-center">
      <h1 className="text-3xl font-bold">Game not found</h1>
      <p className="mt-3 text-muted-foreground">
        This game doesn&apos;t exist or was removed.
      </p>
      <Link href={ROUTES.browse} className={BACK_LINK}>
        Back to games
      </Link>
    </div>
  );
}

/** Network, server and other failures: the game may well exist, so offer a retry. */
export function GameLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-12 text-center">
      <h1 className="text-3xl font-bold">Couldn&apos;t load this game</h1>
      <p role="alert" className="mt-3 text-destructive">
        {message}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-strong px-5 py-3 text-white"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Try Again
        </button>
        <Link
          href={ROUTES.browse}
          className="inline-block rounded-lg border border-brand-strong px-5 py-3 text-brand-strong"
        >
          Back to games
        </Link>
      </div>
    </div>
  );
}
