"use client";

import { useState } from "react";
import { MessageCircle, Plus, X } from "lucide-react";
import ChatPane from "@/components/messages/ChatPane";
import ConversationList from "@/components/messages/ConversationList";
import FriendPicker from "@/components/messages/FriendPicker";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/hooks/useMessages";
import { activeThread } from "@/lib/messages/chat-store";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types/friend";

const PICKER_ID = "new-chat-picker";

export default function Messages() {
  const { state, store, myId } = useMessages();
  const [picking, setPicking] = useState(false);

  const conversations = state.conversations.status === "success" ? state.conversations.data : [];
  const active = conversations.find((conversation) => conversation.id === state.activeId) ?? null;
  const thread = activeThread(state);

  async function startChat(friend: PublicUser) {
    // ChatStore.startChat never rejects; it reports failures in state.startError.
    if (await store.startChat(friend)) setPicking(false);
  }

  function togglePicker() {
    store.dismissStartError();
    setPicking(!picking);
  }

  return (
    <div className="min-h-screen bg-surface-warm">
      <section className="bg-brand px-4 py-12 text-brand-foreground">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <MessageCircle className="size-9" aria-hidden="true" />
            <h1 className="font-heading text-4xl font-bold">Messages</h1>
          </div>
          <p className="mt-3 text-lg text-white/90">Chat with your crew and plan your next game night.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid overflow-hidden rounded-3xl border bg-white md:h-[600px] md:grid-cols-[300px_1fr]">
          {/* On small screens the list is capped so the open chat stays within reach. */}
          <aside className="flex max-h-80 min-h-0 flex-col border-b md:max-h-none md:border-r md:border-b-0">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-xl font-bold">Chats</h2>
              <Button
                variant="outline"
                onClick={togglePicker}
                aria-expanded={picking}
                aria-controls={PICKER_ID}
                className="h-9 rounded-xl"
              >
                {picking ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                {picking ? "Cancel" : "New"}
              </Button>
            </div>

            {picking ? (
              <FriendPicker
                id={PICKER_ID}
                friends={state.friends}
                startingWith={state.startingWith}
                startError={state.startError}
                onStart={(friend) => void startChat(friend)}
                onRetryFriends={() => void store.loadFriends()}
              />
            ) : (
              <ConversationList
                conversations={state.conversations}
                activeId={state.activeId}
                myId={myId}
                onSelect={(id) => store.select(id)}
                onRetry={() => void store.loadConversations()}
              />
            )}
          </aside>

          {/* The pane has its own height on small screens so only the message list scrolls. */}
          <section
            aria-label={active ? "Open chat" : undefined}
            className={cn(
              "flex min-w-0 flex-col md:h-auto md:min-h-0",
              active ? "h-[75svh] min-h-[420px]" : "min-h-[300px]",
            )}
          >
            {active ? (
              <ChatPane
                key={active.id}
                conversation={active}
                thread={thread}
                myId={myId}
                draft={state.drafts[active.id] ?? ""}
                sending={state.sending[active.id] ?? false}
                sendFailure={state.sendFailures[active.id] ?? null}
                onDraftChange={(text) => store.setDraft(active.id, text)}
                onSend={() => void store.send(active.id)}
                onRetrySend={() => void store.retrySend(active.id)}
                onDismissSendFailure={() => store.dismissSendFailure(active.id)}
                onRetryLoad={() => store.retryMessages()}
                onRefreshNow={() => store.poll()}
              />
            ) : (
              <div className="m-auto flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
                <MessageCircle className="size-12 text-brand" aria-hidden="true" />
                <p className="text-lg font-semibold text-foreground">Pick a chat</p>
                <p className="text-sm">Choose a conversation or start a new one.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
