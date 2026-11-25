"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { getFriends } from "@/api/friends";
import { getApiErrorInfo } from "@/api/errors";
import { MemberAvatar, RetryButton } from "@/components/game-nights/details/AttendeesSection";
import { ROUTES } from "@/lib/routes";
import type { PublicUser } from "@/types/friend";

interface InviteFriendsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameNightName: string;
  /** Everyone already on the night (any status); they aren't offered again. */
  existingMemberIds: ReadonlySet<number>;
  /** Resolves to an error message, or null when the invitation was saved. */
  onInvite: (friend: PublicUser) => Promise<string | null>;
}

type FriendsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; friends: PublicUser[] };

/** Host-only: invite accepted friends to the night (POST /api/game-nights/{id}/members). */
function InviteFriendsDialog({ open, onOpenChange, gameNightName, existingMemberIds, onInvite }: InviteFriendsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-xl outline-none">
          <div className="flex items-start justify-between gap-3 border-b p-6 pb-4">
            <div className="min-w-0">
              <Dialog.Title className="font-heading text-xl font-bold">Invite friends</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm break-words text-muted-foreground">
                They&apos;ll get an invitation to {gameNightName}.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {/* Mounted only while open, so the friends list is fresh each time. */}
          {open && <FriendPicker existingMemberIds={existingMemberIds} onInvite={onInvite} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FriendPicker({ existingMemberIds, onInvite }: Pick<InviteFriendsDialogProps, "existingMemberIds" | "onInvite">) {
  const [friends, setFriends] = useState<FriendsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [invited, setInvited] = useState<PublicUser[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let active = true;
    getFriends()
      .then((list) => {
        if (active) setFriends({ status: "success", friends: Array.isArray(list) ? list : [] });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const info = getApiErrorInfo(error);
        setFriends({
          status: "error",
          message: info.kind === "network" ? "Couldn't reach the server." : "Couldn't load your friends.",
        });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  async function invite(friend: PublicUser) {
    if (pending.has(friend.id)) return;
    setPending((prev) => new Set(prev).add(friend.id));
    setErrors(({ [friend.id]: _cleared, ...rest }) => rest);

    const error = await onInvite(friend);
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(friend.id);
      return next;
    });
    if (error) {
      setErrors((prev) => ({ ...prev, [friend.id]: error }));
      setAnnouncement(error);
    } else {
      setInvited((prev) => [...prev, friend]);
      setAnnouncement(`Invited ${friend.name}.`);
    }
  }

  const invitedIds = new Set(invited.map((friend) => friend.id));

  return (
    <div className="overflow-y-auto p-6 pt-4">
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {friends.status === "loading" && (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading your friends…
        </p>
      )}

      {friends.status === "error" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <p role="alert">{friends.message}</p>
          <RetryButton
            onClick={() => {
              setFriends({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
            label="loading friends"
          />
        </div>
      )}

      {friends.status === "success" && (
        <FriendList
          friends={friends.friends.filter((friend) => !existingMemberIds.has(friend.id) || invitedIds.has(friend.id))}
          hasAnyFriends={friends.friends.length > 0}
          invitedIds={invitedIds}
          pending={pending}
          errors={errors}
          onInvite={(friend) => void invite(friend)}
        />
      )}
    </div>
  );
}

function FriendList({
  friends,
  hasAnyFriends,
  invitedIds,
  pending,
  errors,
  onInvite,
}: {
  friends: PublicUser[];
  hasAnyFriends: boolean;
  invitedIds: ReadonlySet<number>;
  pending: ReadonlySet<number>;
  errors: Record<number, string>;
  onInvite: (friend: PublicUser) => void;
}) {
  if (friends.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        <p>{hasAnyFriends ? "All your friends are already on this game night." : "You don't have any friends to invite yet."}</p>
        {!hasAnyFriends && (
          <Link
            href={ROUTES.friends}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Find friends
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {[...friends]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((friend) => {
          const done = invitedIds.has(friend.id);
          const busy = pending.has(friend.id);
          return (
            <li key={friend.id} className="py-2">
              <div className="flex items-center gap-3">
                <MemberAvatar user={friend} />
                <span className="min-w-0 flex-1 font-medium break-words">{friend.name}</span>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-strong">
                    <Check className="size-4" aria-hidden="true" />
                    Invited
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onInvite(friend)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-strong px-4 text-sm font-semibold text-brand-foreground hover:bg-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserPlus className="size-4" aria-hidden="true" />
                    )}
                    {busy ? "Inviting…" : "Invite"}
                    <span className="sr-only"> {friend.name}</span>
                  </button>
                )}
              </div>
              {errors[friend.id] && <p className="mt-1 text-sm text-destructive">{errors[friend.id]}</p>}
            </li>
          );
        })}
    </ul>
  );
}

export default InviteFriendsDialog;
