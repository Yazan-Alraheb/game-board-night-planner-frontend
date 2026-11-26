import { Button } from "@/components/ui/button";
import ChatAvatar, { focusRing } from "@/components/messages/ChatAvatar";
import type { Loadable, StartError } from "@/lib/messages/chat-store";
import { chatErrorMessage, handle } from "@/lib/messages/display";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types/friend";

interface FriendPickerProps {
  id: string;
  friends: Loadable<readonly PublicUser[]>;
  startingWith: number | null;
  startError: StartError | null;
  onStart: (friend: PublicUser) => void;
  onRetryFriends: () => void;
}

export default function FriendPicker({
  id,
  friends,
  startingWith,
  startError,
  onStart,
  onRetryFriends,
}: FriendPickerProps) {
  if (friends.status === "loading") {
    return (
      <p id={id} role="status" className="flex-1 p-6 text-sm text-muted-foreground">
        Loading friends...
      </p>
    );
  }

  if (friends.status === "error") {
    return (
      <div id={id} role="alert" className="flex-1 space-y-3 p-6 text-sm">
        <p className="text-destructive">{chatErrorMessage(friends.error, "load-friends")}</p>
        <Button variant="outline" onClick={onRetryFriends} className="h-9 rounded-xl">
          Retry
        </Button>
      </div>
    );
  }

  const failedFriend = startError && friends.data.find((friend) => friend.id === startError.friendId);

  return (
    <div id={id} className="flex min-h-0 flex-1 flex-col">
      {startError && (
        <div role="alert" className="space-y-2 border-b px-4 py-3 text-sm">
          <p className="text-destructive">{startError.message}</p>
          {failedFriend && (
            <Button
              variant="outline"
              onClick={() => onStart(failedFriend)}
              disabled={startingWith !== null}
              className="h-8 rounded-xl"
            >
              Try again
            </Button>
          )}
        </div>
      )}

      {friends.data.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Add friends to start chatting.</p>
      ) : (
        <ul aria-label="Start a chat with a friend" className="flex-1 overflow-y-auto p-2">
          {friends.data.map((friend) => {
            const username = handle(friend);
            const starting = startingWith === friend.id;
            return (
              <li key={friend.id}>
                <button
                  type="button"
                  onClick={() => onStart(friend)}
                  disabled={startingWith !== null}
                  aria-busy={starting || undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
                    focusRing,
                  )}
                >
                  <ChatAvatar person={friend} className="size-10 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{friend.name}</span>
                    {username && <span className="block truncate text-xs text-muted-foreground">{username}</span>}
                  </span>
                  {starting && <span className="shrink-0 text-xs text-muted-foreground">Starting...</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
