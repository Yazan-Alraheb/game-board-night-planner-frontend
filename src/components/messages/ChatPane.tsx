"use client";

import { memo, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { MAX_MESSAGE_LENGTH } from "@/api/conversations";
import { Button } from "@/components/ui/button";
import ChatAvatar from "@/components/messages/ChatAvatar";
import { REFRESH_FAILURES_BEFORE_WARNING, type SendFailure, type Thread } from "@/lib/messages/chat-store";
import {
  chatErrorMessage,
  conversationTitle,
  findSender,
  formatFullMessageTime,
  formatMessageTime,
  handle,
  otherParticipants,
  showsSenders,
} from "@/lib/messages/display";
import {
  incomingSince,
  isNearBottom,
  shouldScrollToBottom,
  threadView,
  type ThreadView,
} from "@/lib/messages/thread";
import { cn } from "@/lib/utils";
import type { Conversation, Message } from "@/types/conversation";

/** The scrolling message container. `relative` contains its sr-only labels (see below). */
export const MESSAGE_LIST_CLASS =
  "relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-warm/50 p-4";

/** Stable empty list, so effects don't re-run on every render while loading. */
const NO_MESSAGES: readonly Message[] = [];

interface ChatPaneProps {
  conversation: Conversation;
  /** The selected chat's thread; null until its first load starts. */
  thread: Thread | null;
  myId: number | null;
  draft: string;
  sending: boolean;
  sendFailure: SendFailure | null;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  onRetrySend: () => void;
  onDismissSendFailure: () => void;
  onRetryLoad: () => void;
  onRefreshNow: () => void;
}

interface MessageListProps {
  conversation: Conversation;
  messages: readonly Message[];
  myId: number | null;
  title: string;
}

/**
 * The bubbles. Memoized: typing changes only the draft, and these props keep their
 * identity (ChatStore keeps the same messages array when nothing new arrives), so a
 * keystroke never re-renders or re-formats the message list.
 */
const MessageList = memo(function MessageList({ conversation, messages, myId, title }: MessageListProps) {
  const withSenders = showsSenders(conversation);

  return (
    <ol aria-label={`Messages with ${title}`} className="flex flex-col gap-2">
      {messages.map((message) => {
        const mine = message.user_id === myId;
        const sender = withSenders && !mine ? findSender(conversation, message.user_id) : null;
        const senderHandle = handle(sender ?? undefined);

        return (
          <li
            key={message.id}
            className={cn(
              "max-w-[75%] min-w-0 rounded-2xl px-4 py-2",
              mine ? "self-end bg-brand text-white" : "self-start border bg-white",
            )}
          >
            {withSenders && !mine && (
              <p className="truncate text-xs font-semibold text-brand-strong">
                {sender ? sender.name : "Unknown member"}
                {senderHandle && <span className="ml-1 font-normal text-muted-foreground">{senderHandle}</span>}
              </p>
            )}
            {/* Screen readers hear who wrote it; sighted users see the bubble side. */}
            {!withSenders && <span className="sr-only">{mine ? "You: " : `${title}: `}</span>}
            {withSenders && mine && <span className="sr-only">You: </span>}
            <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</p>
            <time
              dateTime={message.created_at}
              title={formatFullMessageTime(message.created_at)}
              className={cn("mt-1 block text-xs", mine ? "text-white/70" : "text-muted-foreground")}
            >
              {formatMessageTime(message.created_at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
});

/**
 * One chat. The parent renders it with `key={conversation.id}`, so switching chats
 * starts with fresh scroll and announcement state.
 */
export default function ChatPane({
  conversation,
  thread,
  myId,
  draft,
  sending,
  sendFailure,
  onDraftChange,
  onSend,
  onRetrySend,
  onDismissSendFailure,
  onRetryLoad,
  onRefreshNow,
}: ChatPaneProps) {
  const title = conversationTitle(conversation, myId);
  const others = otherParticipants(conversation, myId);
  const privateHandle = conversation.type === "private" ? handle(others[0]) : null;
  const inputId = `message-input-${conversation.id}`;

  const status = thread?.status ?? "loading";
  const messages = status === "success" && thread ? thread.messages : NO_MESSAGES;

  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const previousViewRef = useRef<ThreadView | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Scrolls only the message container (never the page), and only when something new
  // arrived at the end: on first load, after an own send, or when already at the bottom.
  useLayoutEffect(() => {
    const next = threadView(conversation.id, status === "success", messages);
    const previous = previousViewRef.current;
    const list = listRef.current;
    const newestIsMine = myId !== null && messages.at(-1)?.user_id === myId;

    if (list && shouldScrollToBottom(previous, next, newestIsMine, nearBottomRef.current)) {
      list.scrollTop = list.scrollHeight;
      nearBottomRef.current = true;
    }

    const incoming = incomingSince(previous, next, messages, myId);
    if (incoming.length === 1) {
      const sender = findSender(conversation, incoming[0].user_id);
      setAnnouncement(sender ? `New message from ${sender.name}` : "New message");
    } else if (incoming.length > 1) {
      setAnnouncement(`${incoming.length} new messages`);
    }

    previousViewRef.current = next;
  }, [conversation, status, messages, myId]);

  function handleScroll() {
    const list = listRef.current;
    if (list) nearBottomRef.current = isNearBottom(list.scrollTop, list.scrollHeight, list.clientHeight);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSend();
  }

  return (
    // `relative`: positioned ancestor for the sr-only label and live region below.
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 items-center gap-3 border-b p-4">
        {others[0] && <ChatAvatar person={others[0]} className="size-10 text-sm" />}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          {privateHandle && <p className="truncate text-xs text-muted-foreground">{privateHandle}</p>}
        </div>
      </div>

      {/*
        MESSAGE_LIST_CLASS must stay `relative`: the bubbles' sr-only labels are
        position:absolute. Without a positioned scroller they belong to <body>, escape
        this overflow clip and stretch the page by the list's full height, so the page
        could scroll far past the composer and typing snapped it back into view.
      */}
      <div ref={listRef} onScroll={handleScroll} data-message-list="" className={MESSAGE_LIST_CLASS}>
        {status === "loading" && (
          <p role="status" className="m-auto text-sm text-muted-foreground">
            Loading messages...
          </p>
        )}

        {status === "error" && thread?.error && (
          <div role="alert" className="m-auto flex flex-col items-center gap-3 text-center text-sm">
            <p className="text-destructive">{chatErrorMessage(thread.error, "load-messages")}</p>
            <Button variant="outline" onClick={onRetryLoad} className="h-9 rounded-xl">
              Retry
            </Button>
          </div>
        )}

        {status === "success" && messages.length === 0 && (
          <p className="m-auto text-sm text-muted-foreground">Say hello</p>
        )}

        {status === "success" && messages.length > 0 && (
          <MessageList conversation={conversation} messages={messages} myId={myId} title={title} />
        )}
      </div>

      {/* Announces new incoming messages only, never the whole history. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {thread && thread.status === "success" && thread.refreshFailures >= REFRESH_FAILURES_BEFORE_WARNING && (
        <div role="status" className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
          <span>Couldn&apos;t check for new messages. Retrying automatically.</span>
          <Button variant="outline" onClick={onRefreshNow} className="h-8 rounded-xl">
            Retry now
          </Button>
        </div>
      )}

      {sendFailure && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-sm">
          <span className="text-destructive">
            {sendFailure.message}
            {!sendFailure.unsent && " Your message is back in the box below."}
          </span>
          {sendFailure.unsent && (
            <Button variant="outline" onClick={onRetrySend} disabled={sending} className="h-8 rounded-xl">
              Retry
            </Button>
          )}
          <Button variant="ghost" onClick={onDismissSendFailure} className="h-8 rounded-xl">
            Dismiss
          </Button>
        </div>
      )}

      {status !== "error" && (
        <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
          <label htmlFor={inputId} className="sr-only">
            Message {title}
          </label>
          <input
            id={inputId}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Type a message..."
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border px-4 py-3 focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand/40"
          />
          <Button
            type="submit"
            disabled={sending || !draft.trim()}
            className="h-auto rounded-xl bg-cta px-5 text-cta-foreground hover:bg-cta/90"
          >
            <Send className="size-4" aria-hidden="true" />
            {sending ? "Sending..." : "Send"}
          </Button>
        </form>
      )}
    </div>
  );
}
