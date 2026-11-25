"use client";

import { useState, type SubmitEvent } from "react";
import { Search, UserPlus } from "lucide-react";
import axios from "axios";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
  getFriends,
} from "@/api/friends";

import { getInitials, placeholderColor } from "@/lib/format";
import type { PublicUser } from "@/types/friend";
interface FindFriendsProps {
  onRequestSent: () => void;
}
export default function FindFriends({
  onRequestSent,
}: FindFriendsProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[] | null>(null);

  const [friendIds, setFriendIds] = useState<number[]>([]);
  const [incomingIds, setIncomingIds] = useState<number[]>([]);
  const [outgoingIds, setOutgoingIds] = useState<number[]>([]);

  const [searching, setSearching] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Search for registered users
  async function handleSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim() || searching || sendingId !== null) return;

    setSearching(true);
    setError("");
    setMessage("");
    setResults(null);

    try {
      const [users, friends, incoming, outgoing] =
        await Promise.all([
          searchUsers(query.trim()),
          getFriends(),
          getFriendRequests("incoming"),
          getFriendRequests("outgoing"),
        ]);

      setResults(users);
      setFriendIds(friends.map((friend) => friend.id));
      setIncomingIds(incoming.map((request) => request.requester_id));
      setOutgoingIds(outgoing.map((request) => request.receiver_id));
    } catch {
      setError("Unable to search for users. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  // Send a friend request
  async function handleAddFriend(user: PublicUser) {
    if (sendingId !== null || searching) return;

    setSendingId(user.id);
    setError("");
    setMessage("");

    try {
      await sendFriendRequest(user.id);

      setOutgoingIds((previous) => [...previous, user.id]);

      setMessage(`Friend request sent to ${user.name}!`);

      onRequestSent();
      
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;

        setError(
          typeof detail === "string" &&
          [400, 404, 409].includes(err.response?.status ?? 0)
            ? detail
            : "Unable to send friend request. Please try again."
        );
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Card className="mb-8 gap-4 p-6">
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <UserPlus className="size-6 text-brand" />
        Find Friends
      </h2>

      <p className="text-muted-foreground">
        Search by name or username. Use @username for an exact match.
      </p>

      {/* Search bar */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          type="search"
          aria-label="Search users by name or username"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or username..."
          disabled={searching || sendingId !== null}
          required
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-4 outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />

        <Button
          type="submit"
          disabled={
            searching ||
            !query.trim() ||
            sendingId !== null
          }
          className="h-11 bg-brand-strong text-white hover:bg-brand"
        >
          <Search className="size-4" />

          {searching ? "Searching..." : "Search"}
        </Button>
      </form>

      {/* Error and success messages */}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-sm text-brand-strong">
          {message}
        </p>
      )}

      {/* Empty search results */}
      {results?.length === 0 && (
        <p className="py-4 text-center text-muted-foreground">
          No users found.
        </p>
      )}

      {/* Search results */}
      {results && results.length > 0 && (
        <div className="divide-y">
          {results.map((user) => {
            const isFriend = friendIds.includes(user.id);
            const isIncoming = incomingIds.includes(user.id);
            const isOutgoing = outgoingIds.includes(user.id);

            const buttonLabel = isFriend
              ? "Already Friends"
              : isIncoming
                ? "Incoming Request"
                : isOutgoing
                  ? "Request Sent"
                  : sendingId === user.id
                    ? "Sending..."
                    : "Add Friend";

            return (
              <div
                key={user.id}
                className="flex flex-wrap items-center gap-4 py-4"
              >
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full font-bold ${placeholderColor(user.id)}`}
                >
                  {getInitials(user.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold">
                    {user.name}
                  </h3>

                  <p className="break-words text-sm font-medium text-brand-strong">
                    @{user.username}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {user.bio || "Game Night member"}
                  </p>
                </div>

                <Button
                  variant="outline"
                  disabled={
                    isFriend ||
                    isIncoming ||
                    isOutgoing ||
                    sendingId !== null ||
                    searching
                  }
                  onClick={() => handleAddFriend(user)}
                  className="shrink-0"
                >
                  {buttonLabel}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
