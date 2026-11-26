"use client";
import FindFriends from "@/components/friends/FindFriends";
import { useEffect, useState } from "react";
import { Users, UserMinus, RefreshCw } from "lucide-react";
import axios from "axios";
import IncomingRequests from "@/components/friends/IncomingRequests";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFriends, removeFriend } from "@/api/friends";
import { getInitials, placeholderColor } from "@/lib/format";
import type { PublicUser } from "@/types/friend";
import OutgoingRequests from "@/components/friends/OutgoingRequests";
export default function Friends() {
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [outgoingReloadKey, setOutgoingReloadKey] = useState(0);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;

    async function loadFriends() {
      setLoading(true);
      setError("");

      try {
        const data = await getFriends();

        if (active) {
          setFriends(data);
        }
      } catch {
        if (active) {
          setError("Unable to load friends. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadFriends();

    return () => {
      active = false;
    };
  }, [reloadKey]);

async function handleRemoveFriend(friend: PublicUser) {
  if (removingId !== null || loading) return;

  const confirmed = window.confirm(
    `Are you sure you want to remove ${friend.name} from your friends?`
  );

  if (!confirmed) return;

  setRemovingId(friend.id);
  setRemoveError("");
  setMessage("");

  try {
    await removeFriend(friend.id);

    setFriends((previous) =>
      previous.filter((user) => user.id !== friend.id)
    );

    setMessage(`${friend.name} was removed from your friends.`);

    setReloadKey((key) => key + 1);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const detail = err.response?.data?.detail;

      setRemoveError(
        err.response?.status === 404 &&
        typeof detail === "string"
          ? detail
          : "Unable to remove friend. Please try again."
      );
    } else {
      setRemoveError("An unexpected error occurred.");
    }
  } finally {
    setRemovingId(null);
  }
}

  return (
    <div className="min-h-screen bg-surface-warm">
      {/* Page header */}
      <section className="bg-brand px-4 py-12 text-brand-foreground">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <Users className="size-9" aria-hidden="true" />

            <h1 className="font-heading text-4xl font-bold">
              Friends
            </h1>
          </div>

          <p className="mt-3 text-lg text-white/90">
            Find friends and grow your gaming community.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <FindFriends
          key={reloadKey}
          onRequestSent={() =>
            setOutgoingReloadKey((key) => key + 1)
          }
        />
        <IncomingRequests
          onChanged={() => setReloadKey((key) => key + 1)}
        />
        <OutgoingRequests
          refreshKey={outgoingReloadKey}
          onChanged={() => setReloadKey((key) => key + 1)}
        />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">
            My Friends {!loading && !error && `(${friends.length})`}
          </h2>

          <Button
            variant="outline"
            disabled={loading || removingId !== null}
            onClick={() => {
              setMessage("");
              setRemoveError("");
              setReloadKey((key) => key + 1);
            }}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        {message && (
          <p role="status" className="mb-4 text-sm text-brand-strong">
            {message}
          </p>
        )}

        {removeError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {removeError}
          </p>
        )}

        {/* Loading state */}
        {loading && (
          <p role="status" className="text-muted-foreground">
            Loading friends...
          </p>
        )}

        {/* Error state */}
        {error && (
          <Card className="p-6">
            <p role="alert" className="text-destructive">
              {error}
            </p>

            <Button
              variant="outline"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Try Again
            </Button>
          </Card>
        )}

        {/* Empty state */}
        {!loading && !error && friends.length === 0 && (
          <Card className="items-center p-12 text-center">
            <Users className="size-12 text-brand" />

            <h3 className="text-xl font-semibold">
              No friends yet
            </h3>

            <p className="text-muted-foreground">
              Add friends to start planning game nights together.
            </p>
          </Card>
        )}

        {/* Friends list */}
        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((friend) => (
              <Card key={friend.id} className="gap-4 p-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex size-14 shrink-0 items-center justify-center rounded-full font-bold ${placeholderColor(friend.id)}`}
                  >
                    {getInitials(friend.name)}
                  </div>

                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-semibold">
                      {friend.name}
                    </h3>

                    <p className="break-words text-sm font-medium text-brand-strong">
                      @{friend.username}
                    </p>

                    <p className="break-words text-sm text-muted-foreground">
                      {friend.bio || "Game Night member"}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  disabled={removingId !== null}
                  onClick={() => handleRemoveFriend(friend)}
                  className="w-full text-destructive"
                >
                  <UserMinus className="size-4" />

                  {removingId === friend.id
                    ? "Removing..."
                    : "Remove Friend"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
