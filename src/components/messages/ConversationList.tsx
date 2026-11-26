import { Button } from "@/components/ui/button";
import ChatAvatar, { focusRing } from "@/components/messages/ChatAvatar";
import type { Loadable } from "@/lib/messages/chat-store";
import {
  chatErrorMessage,
  conversationKind,
  conversationTitle,
  handle,
  otherParticipants,
} from "@/lib/messages/display";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/conversation";

interface ConversationListProps {
  conversations: Loadable<readonly Conversation[]>;
  activeId: number | null;
  myId: number | null;
  onSelect: (conversationId: number) => void;
  onRetry: () => void;
}

export default function ConversationList({
  conversations,
  activeId,
  myId,
  onSelect,
  onRetry,
}: ConversationListProps) {
  if (conversations.status === "loading") {
    return (
      <p role="status" className="flex-1 p-6 text-sm text-muted-foreground">
        Loading chats...
      </p>
    );
  }

  if (conversations.status === "error") {
    return (
      <div role="alert" className="flex-1 space-y-3 p-6 text-sm">
        <p className="text-destructive">{chatErrorMessage(conversations.error, "load-chats")}</p>
        <Button variant="outline" onClick={onRetry} className="h-9 rounded-xl">
          Retry
        </Button>
      </div>
    );
  }

  if (conversations.data.length === 0) {
    return <p className="flex-1 p-6 text-sm text-muted-foreground">No chats yet. Tap New to message a friend.</p>;
  }

  return (
    <ul aria-label="Your chats" className="flex-1 overflow-y-auto p-2">
      {conversations.data.map((conversation) => {
        const others = otherParticipants(conversation, myId);
        const selected = conversation.id === activeId;
        const username = conversation.type === "private" ? handle(others[0]) : null;
        const kind = conversationKind(conversation);

        return (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted",
                focusRing,
                selected && "bg-brand-soft text-brand-strong hover:bg-brand-soft",
              )}
            >
              {others[0] && <ChatAvatar person={others[0]} className="size-10 text-sm" />}
              <span className="min-w-0">
                <span className="block truncate font-medium">{conversationTitle(conversation, myId)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {username ? `${username} · ${kind}` : kind}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
