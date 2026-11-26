"use client";

import axios from "axios";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import {
  getCollection,
  removeFromCollection,
  updateCollectionStatus,
  type CollectionEntry,
  type CollectionStatus,
} from "@/api/collection";
import GameCard from "@/components/home/GameCard";

export default function CollectionPage() {
  const { session } = useAuth();
  const [games, setGames] = useState<CollectionEntry[]>([]);
  const [activeTab, setActiveTab] =
    useState<CollectionStatus>("owned");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionGameId, setActionGameId] = useState<number | null>(
    null,
  );
  const [message, setMessage] = useState("");

  // load the users collection from the backend
  async function loadCollection() {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError("");

      const collection = await getCollection(session.user.id);
      setGames(collection);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError("Could not load your collection.");
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollection();
  }, [session?.user?.id]);

  // Move a game between the owned and wishlist sections.
  async function changeStatus(
    gameId: number,
    status: CollectionStatus,
  ) {
    if (!session?.user?.id) return;

    try {
      setActionGameId(gameId);
      setMessage("");

      await updateCollectionStatus(
        session.user.id,
        gameId,
        status,
      );

      setGames((currentGames) =>
        currentGames.map((entry) =>
          entry.game.id === gameId
            ? { ...entry, status }
            : entry,
        ),
      );

      setMessage("Game updated.");
    } catch {
      setMessage("Could not update this game.");
    } finally {
      setActionGameId(null);
    }
  }

  // Remove a game from the user's collection.
  async function removeGame(gameId: number) {
    if (!session?.user?.id) return;

    try {
      setActionGameId(gameId);
      setMessage("");

      await removeFromCollection(session.user.id, gameId);

      setGames((currentGames) =>
        currentGames.filter((entry) => entry.game.id !== gameId),
      );

      setMessage("Game removed.");
    } catch {
      setMessage("Could not remove this game.");
    } finally {
      setActionGameId(null);
    }
  }

  const visibleGames = games.filter(
    (entry) => entry.status === activeTab,
  );

  return (
    <main className="min-h-screen bg-surface-warm px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="font-heading text-4xl font-bold">
          My Collection
        </h1>

        <p className="mt-2 text-muted-foreground">
          Keep track of games you own and want to play.
        </p>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("owned")}
            className={
              activeTab === "owned"
                ? "rounded-lg bg-brand-strong px-4 py-2 text-white"
                : "rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700"
            }
          >
            Owned Games
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wishlist")}
            className={
              activeTab === "wishlist"
                ? "rounded-lg bg-brand-strong px-4 py-2 text-white"
                : "rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700"
            }
          >
            Wishlist
          </button>
        </div>

        {message && (
          <p className="mt-4 text-sm text-gray-600">{message}</p>
        )}

        {loading && (
          <p className="mt-8">Loading your collection...</p>
        )}

        {error && (
          <p className="mt-8 text-red-600">{error}</p>
        )}

        {!loading && !error && visibleGames.length === 0 && (
          <p className="mt-8 text-gray-600">
            No games here yet.
          </p>
        )}

        {!loading && !error && visibleGames.length > 0 && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visibleGames.map((entry) => {
              const movingTo =
                entry.status === "owned"
                  ? "wishlist"
                  : "owned";

              const movingLabel =
                entry.status === "owned"
                  ? "Move to Wishlist"
                  : "Move to Collection";

              const isWorking = actionGameId === entry.game.id;

              return (
                <div key={entry.game.id}>
                  <GameCard game={entry.game} />

                  {entry.status === "owned" && (
                    <div className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-strong">
                      <CheckCircle2 className="h-4 w-4" />
                      Owned
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() =>
                        changeStatus(entry.game.id, movingTo)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {isWorking ? "Updating..." : movingLabel}
                    </button>

                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => removeGame(entry.game.id)}
                      className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}