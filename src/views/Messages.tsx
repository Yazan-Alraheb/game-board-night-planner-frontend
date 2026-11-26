"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { MessageCircle, Plus, Send, X } from "lucide-react";
import api from "@/api/client";
import { getFriends } from "@/api/friends";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { getInitials, placeholderColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types/friend";

interface Conversation {
  id: number;
  type: "private" | "group";
  game_night_id: number | null;
  participants: PublicUser[];
  created_at: string;
}

interface Message {
  id: number;
  conversation_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function Avatar({ person, className }: { person: PublicUser; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold", placeholderColor(person.id), className)}>
      {person.avatar_url ? <img src={person.avatar_url} alt="" className="size-full object-cover" /> : getInitials(person.name)}
    </span>
  );
}

export default function Messages() {
  const { session } = useAuth();
  const myId = session?.user.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    const response = await api.get<{ conversations: Conversation[] }>("/conversations");
    setConversations(response.data.conversations);
    return response.data.conversations;
  }

  useEffect(() => {
    api
      .get<{ conversations: Conversation[] }>("/conversations")
      .then((response) => setConversations(response.data.conversations))
      .catch(() => setError("Unable to load messages. Please try again."))
      .finally(() => setLoading(false));
    getFriends().then(setFriends).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeId === null) return;

    function loadMessages() {
      api
        .get<{ messages: Message[] }>(`/conversations/${activeId}/messages`)
        .then((response) => setMessages([...response.data.messages].reverse()))
        .catch(() => {});
    }

    loadMessages();
    const timer = setInterval(loadMessages, 5000);
    return () => clearInterval(timer);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const others = (c: Conversation) => c.participants.filter((p) => p.id !== myId);
  const title = (c: Conversation) => others(c).map((p) => p.name).join(", ") || "Just you";
  const active = conversations.find((c) => c.id === activeId);

  function findChatWith(list: Conversation[], friend: PublicUser) {
    return list.find((c) => c.type === "private" && others(c).some((p) => p.id === friend.id));
  }

  async function startChat(friend: PublicUser) {
    setPicking(false);
    setError("");
    const existing = findChatWith(conversations, friend);
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    try {
      const response = await api.post<{ conversation: Conversation }>("/conversations", { participant_ids: [friend.id], type: "private" });
      setConversations([response.data.conversation, ...conversations]);
      setActiveId(response.data.conversation.id);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const match = findChatWith(await loadConversations(), friend);
        if (match) setActiveId(match.id);
      } else {
        setError("Unable to start a conversation. Please try again.");
      }
    }
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || activeId === null) return;
    setDraft("");
    try {
      const response = await api.post<{ message: Message }>(`/conversations/${activeId}/messages`, { content });
      setMessages((previous) => [...previous, response.data.message]);
    } catch {
      setDraft(content);
      setError("Message failed to send. Please try again.");
    }
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
          <aside className="flex flex-col border-b md:border-r md:border-b-0">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-xl font-bold">Chats</h2>
              <Button variant="outline" onClick={() => setPicking(!picking)} className="h-9 rounded-xl">
                {picking ? <X className="size-4" /> : <Plus className="size-4" />}
                {picking ? "Cancel" : "New"}
              </Button>
            </div>

            {picking ? (
              <ul className="flex-1 overflow-y-auto p-2">
                {friends.length === 0 && <li className="p-4 text-sm text-muted-foreground">Add friends to start chatting.</li>}
                {friends.map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => startChat(f)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted">
                      <Avatar person={f} className="size-10 text-sm" />
                      <span className="font-medium">{f.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="flex-1 overflow-y-auto p-2">
                {loading && <li className="p-4 text-sm text-muted-foreground">Loading chats...</li>}
                {!loading && conversations.length === 0 && <li className="p-4 text-sm text-muted-foreground">No chats yet. Tap New to message a friend.</li>}
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setActiveId(c.id)} className={cn("flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted", c.id === activeId && "bg-brand-soft text-brand-strong hover:bg-brand-soft")}>
                      {others(c)[0] && <Avatar person={others(c)[0]} className="size-10 text-sm" />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{title(c)}</span>
                        <span className="block text-xs text-muted-foreground">{c.game_night_id ? "Game night chat" : c.type === "group" ? "Group" : "Direct message"}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="flex min-h-[400px] flex-col">
            {active ? (
              <>
                <div className="flex items-center gap-3 border-b p-4">
                  {others(active)[0] && <Avatar person={others(active)[0]} className="size-10 text-sm" />}
                  <h2 className="truncate text-lg font-bold">{title(active)}</h2>
                </div>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-surface-warm/50 p-4">
                  {messages.length === 0 && <p className="m-auto text-sm text-muted-foreground">Say hello</p>}
                  {messages.map((m) => {
                    const mine = m.user_id === myId;
                    return (
                      <div key={m.id} className={cn("max-w-[75%] rounded-2xl px-4 py-2", mine ? "self-end bg-brand text-white" : "self-start border bg-white")}>
                        <p className="break-words whitespace-pre-wrap">{m.content}</p>
                        <p className={cn("mt-1 text-xs", mine ? "text-white/70" : "text-muted-foreground")}>{timeFormat.format(new Date(m.created_at))}</p>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={handleSend} className="flex gap-2 border-t p-4">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Type a message..." className="flex-1 rounded-xl border px-4 py-3 focus-visible:border-brand focus-visible:outline-none" />
                  <Button type="submit" disabled={!draft.trim()} className="h-auto rounded-xl bg-cta px-5 text-cta-foreground hover:bg-cta/90">
                    <Send className="size-4" />
                    Send
                  </Button>
                </form>
              </>
            ) : (
              <div className="m-auto flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
                <MessageCircle className="size-12 text-brand" aria-hidden="true" />
                <p className="text-lg font-semibold text-foreground">Pick a chat</p>
                <p className="text-sm">Choose a conversation or start a new one.</p>
              </div>
            )}
            {error && <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
