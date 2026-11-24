"use client";

import { useEffect, useState } from "react";
import { UserPlus, Check, X, RefreshCw } from "lucide-react";
import axios from "axios";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  getFriendRequests,
  getUser,
  updateFriendRequest,
} from "@/api/friends";

import { getInitials, placeholderColor } from "@/lib/format";

import type {
  FriendRequest,
  PublicUser,
} from "@/types/friend";

interface IncomingRequest {
  request: FriendRequest;
  user: PublicUser | null;
}

interface IncomingRequestsProps {
  onChanged: () => void;
}

export default function IncomingRequests({
  onChanged,
}: IncomingRequestsProps) {
  const [requests, setRequests] =
    useState<IncomingRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Load incoming friend requests and sender profiles.
  useEffect(() => {
    let active = true;

    async function loadRequests() {
      setLoading(true);
      setError("");

      try {
        const incoming = await getFriendRequests("incoming");

        const data = await Promise.all(
          incoming.map(async (request) => {
            try {
              const user = await getUser(request.requester_id);
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
          setError("Unable to load incoming requests.");
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
  }, [reloadKey]);

  // Accept or decline an incoming request.
  async function handleRequest(
    requestId: number,
    status: "accepted" | "declined",
    userName: string
  ) {
    if (processingId !== null || loading) return;

    setProcessingId(requestId);
    setError("");
    setMessage("");

    try {
      await updateFriendRequest(requestId, status);

      // Remove the resolved request from the list.
      setRequests((previous) =>
        previous.filter(
          (item) => item.request.id !== requestId
        )
      );

      setMessage(
        status === "accepted"
          ? `You are now friends with ${userName}!`
          : `Friend request from ${userName} declined.`
      );

      // Refresh the parent Friends page.
      onChanged();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;

        setError(
          typeof detail === "string" &&
          [403, 404, 409].includes(err.response?.status ?? 0)
            ? detail
            : "Unable to update friend request."
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
          <UserPlus className="size-6 text-brand" />

          Incoming Requests
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
          Loading incoming requests...
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
          No incoming friend requests.
        </p>
      )}

      {/* Incoming requests list */}
      {!loading && (
        <div className="divide-y">
          {requests.map(({ request, user }) => {
            const name =
              user?.name ?? `User #${request.requester_id}`;

            return (
              <div
                key={request.id}
                className="flex flex-wrap items-center gap-4 py-4"
              >
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full font-bold ${placeholderColor(request.requester_id)}`}
                >
                  {getInitials(name)}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">
                    {name}
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    Sent you a friend request
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    disabled={processingId !== null}
                    onClick={() =>
                      handleRequest(
                        request.id,
                        "accepted",
                        name
                      )
                    }
                    className="bg-brand-strong text-white hover:bg-brand"
                  >
                    <Check className="size-4" />

                    {processingId === request.id
                      ? "Processing..."
                      : "Accept"}
                  </Button>

                  <Button
                    variant="outline"
                    disabled={processingId !== null}
                    onClick={() =>
                      handleRequest(
                        request.id,
                        "declined",
                        name
                      )
                    }
                  >
                    <X className="size-4" />
                    Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
