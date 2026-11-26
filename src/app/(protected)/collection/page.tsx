"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import {
  getCollection,
  removeFromCollection,
  updateCollectionStatus,
  type CollectionEntry,
  type CollectionStatus,
} from "@/api/collection";
import ConfirmDialog from "@/components/game-nights/details/ConfirmDialog";
import GameCard from "@/components/home/GameCard";
import { Button } from "@/components/ui/button";
import { useUserResource } from "@/hooks/useUserResource";
import {
  editCollection,
  entriesForTab,
  NO_EDITS,
  removalCopy,
  visibleCollection,
  withoutGame,
  withStatus,
  type CollectionEdits,
} from "@/lib/games/collection-page";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Owned and wishlist games of the signed-in user. */
function loadCollection(userId: number, signal: AbortSignal) {
  return getCollection(userId, undefined, signal);
}

const TAB_CLASS = "rounded-lg px-4 py-2 font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export default function CollectionPage() {
  const { session } = useAuth();
  // One view per user: a previous account's tab, messages and dialogs never carry over.
  return <CollectionView key={session?.user.id ?? "signed-out"} userId={session?.user.id ?? null} />;
}

function CollectionView({ userId }: { userId: number | null }) {
  const [resource, retry] = useUserResource(loadCollection);
  const [edits, setEdits] = useState<CollectionEdits>(NO_EDITS);
  const [activeTab, setActiveTab] = useState<CollectionStatus>("owned");
  const [actionGameId, setActionGameId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [removalTarget, setRemovalTarget] = useState<CollectionEntry | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);

  const source = resource.status === "success" ? resource.data : null;
  const games = visibleCollection(source, edits);
  const visibleGames = entriesForTab(games, activeTab);

  // Move a game between the owned and wishlist sections.
  async function changeStatus(gameId: number, status: CollectionStatus) {
    if (userId === null || source === null) return;

    setActionGameId(gameId);
    setMessage("");

    try {
      await updateCollectionStatus(userId, gameId, status);
      // Applies to the collection this action was started on, never to a newer load.
      setEdits((current) => editCollection(current, source, withStatus(gameId, status)));
      setMessage(status === "owned" ? "Moved to your owned games." : "Moved to your wishlist.");
    } catch {
      setMessage("Could not update this game.");
    } finally {
      setActionGameId(null);
    }
  }

  function requestRemove(entry: CollectionEntry) {
    setRemovalError(null);
    setRemovalTarget(entry);
  }

  // Remove a game from the user's collection, after confirmation.
  async function confirmRemove() {
    const entry = removalTarget;
    if (userId === null || source === null || entry === null) return;

    const gameId = entry.game.id;
    setActionGameId(gameId);
    setRemovalError(null);
    setMessage("");

    try {
      await removeFromCollection(userId, gameId);
      setEdits((current) => editCollection(current, source, withoutGame(gameId)));
      setRemovalTarget(null);
      setMessage(`${entry.game.name} was removed.`);
    } catch {
      setRemovalError("Could not remove this game. Please try again.");
    } finally {
      setActionGameId(null);
    }
  }

  const removal = removalTarget ? removalCopy(removalTarget) : null;

  return (
    <div className="min-h-screen bg-surface-warm px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="font-heading text-4xl font-bold">My Collection</h1>

        <p className="mt-2 text-muted-foreground">Keep track of games you own and want to play.</p>

        <div className="mt-8 flex gap-3">
          {(
            [
              ["owned", "Owned Games"],
              ["wishlist", "Wishlist"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                TAB_CLASS,
                activeTab === tab ? "bg-brand-strong text-white" : "border bg-white text-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p role="status" className="mt-4 min-h-5 text-sm text-muted-foreground">
          {message}
        </p>

        {resource.status === "loading" && (
          <p role="status" className="mt-4">
            Loading your collection...
          </p>
        )}

        {resource.status === "error" && (
          <div role="alert" className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-destructive">Could not load your collection.</p>
            <Button type="button" variant="outline" onClick={retry} className="rounded-lg">
              Try again
            </Button>
          </div>
        )}

        {source !== null && visibleGames.length === 0 && (
          <div className="mt-4 rounded-2xl border-2 border-dashed bg-white p-8 text-center">
            <p className="text-muted-foreground">
              {activeTab === "owned" ? "No owned games yet." : "Your wishlist is empty."}
            </p>
            <Link
              href={ROUTES.browse}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Browse games
            </Link>
          </div>
        )}

        {source !== null && visibleGames.length > 0 && (
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visibleGames.map((entry) => {
              const movingTo = entry.status === "owned" ? "wishlist" : "owned";
              const movingLabel = entry.status === "owned" ? "Move to Wishlist" : "Move to Collection";
              const isWorking = actionGameId === entry.game.id;

              return (
                <li key={entry.game.id}>
                  <GameCard game={entry.game} />

                  {entry.status === "owned" && (
                    <div className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-strong">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Owned
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => changeStatus(entry.game.id, movingTo)}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {isWorking && removalTarget === null ? "Updating..." : movingLabel}
                    </button>

                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => requestRemove(entry)}
                      aria-label={`Remove ${entry.game.name}`}
                      className="w-full rounded-lg border border-destructive/40 bg-white px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={removalTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemovalTarget(null);
        }}
        title={removal?.title ?? ""}
        description={removal?.description ?? ""}
        confirmLabel="Remove"
        pendingLabel="Removing..."
        pending={removalTarget !== null && actionGameId === removalTarget.game.id}
        error={removalError}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
