"use client";

import { useEffect, useState } from "react";
import { Send, X, RefreshCw } from "lucide-react";
import axios from "axios";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  getFriendRequests,
  getUser,
  cancelFriendRequest,
} from "@/api/friends";

import { getInitials, placeholderColor } from "@/lib/format";

import type {
  FriendRequest,
  PublicUser,
} from "@/types/friend";

interface OutgoingRequest {
  request: FriendRequest;
  user: PublicUser | null;
}

interface OutgoingRequestsProps {
  refreshKey: number;
  onChanged: () => void;
}

export default function OutgoingRequests({
  refreshKey,
  onChanged,
}: OutgoingRequestsProps) {
  const [requests, setRequests] =
    useState<OutgoingRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Load outgoing requests and recipient profiles.
  useEffect(() => {
    let active = true;

    async function loadRequests() {
      setLoading(true);
      setError("");

      try {
        const outgoing = await getFriendRequests("outgoing");

        const data = await Promise.all(
          outgoing.map(async (request) => {
            try {
              const user = await getUser(request.receiver_id);
              return { request, user };
            } catch {
              return { request, user: null };
            }
          })
        );

        if (active) {
          setRequests(data);
        }
      } catch {
        if (active) {
          setError("Unable to load outgoing requests.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRequests();

    return () => {
      active = false;
    };
  }, [reloadKey, refreshKey]);

  // Cancel a pending outgoing request.
  async function handleCancel(
    requestId: number,
    userName: string
  ) {
    if (processingId !== null || loading) return;

    setProcessingId(requestId);
    setError("");
    setMessage("");

    try {
      await cancelFriendRequest(requestId);

      setRequests((previous) =>
        previous.filter(
          (item) => item.request.id !== requestId
        )
      );

      setMessage(
        `Friend request to ${userName} cancelled.`
      );

      onChanged();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;

        setError(
          typeof detail === "string" &&
          [403, 404, 409].includes(err.response?.status ?? 0)
            ? detail
            : "Unable to cancel friend request."
        );
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Card className="mb-8 gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Send className="size-6 text-brand" />

          Outgoing Requests
          {!loading && ` (${requests.length})`}
        </h2>

        <Button
          variant="outline"
          disabled={loading || processingId !== null}
          onClick={() => {
            setMessage("");
            setReloadKey((key) => key + 1);
          }}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <p role="status" className="text-muted-foreground">
          Loading outgoing requests...
        </p>
      )}

      {/* Error message */}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Success message */}
      {message && (
        <p role="status" className="text-sm text-brand-strong">
          {message}
        </p>
      )}

      {/* Empty state */}
      {!loading && !error && requests.length === 0 && (
        <p className="py-4 text-center text-muted-foreground">
          No outgoing friend requests.
        </p>
      )}

      {/* Outgoing requests list */}
      {!loading && (
        <div className="divide-y">
          {requests.map(({ request, user }) => {
            const name =
              user?.name ?? `User #${request.receiver_id}`;

            return (
              <div
                key={request.id}
                className="flex flex-wrap items-center gap-4 py-4"
              >
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full font-bold ${placeholderColor(request.receiver_id)}`}
                >
                  {getInitials(name)}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold">
                    {name}
                  </h3>

                  {user?.username && (
                    <p className="break-words text-sm font-medium text-brand-strong">
                      @{user.username}
                    </p>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Awaiting response
                  </p>
                </div>

                <Button
                  variant="outline"
                  disabled={processingId !== null}
                  onClick={() =>
                    handleCancel(request.id, name)
                  }
                  className="text-destructive"
                >
                  <X className="size-4" />

                  {processingId === request.id
                    ? "Cancelling..."
                    : "Cancel Request"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
