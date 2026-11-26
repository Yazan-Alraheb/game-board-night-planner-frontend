/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import { AxiosError } from "axios";
import { activeThread, ChatStore, type ChatApi, type ChatState } from "@/lib/messages/chat-store";
import type { Conversation, Message } from "@/types/conversation";
import type { PublicUser } from "@/types/friend";

// ---- Fake API: every call waits until the test resolves or rejects it, in any order. ----

interface Call<A, T> {
  args: A;
  signal?: AbortSignal;
  resolve: (value: T) => Promise<void>;
  reject: (error: unknown) => Promise<void>;
}

/** Lets the store's awaits, catch and finally blocks run before assertions. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function controllable<A, T>(calls: Call<A, T>[], args: A, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    calls.push({
      args,
      signal,
      resolve: (value) => {
        resolve(value);
        return flush();
      },
      reject: (error) => {
        reject(error);
        return flush();
      },
    });
  });
}

function fakeApi() {
  const calls = {
    conversations: [] as Call<null, Conversation[]>[],
    friends: [] as Call<null, PublicUser[]>[],
    create: [] as Call<number, Conversation>[],
    messages: [] as Call<number, Message[]>[],
    send: [] as Call<{ conversationId: number; content: string }, Message>[],
  };

  const api: ChatApi = {
    getConversations: (signal) => controllable(calls.conversations, null, signal),
    getFriends: () => controllable(calls.friends, null),
    createPrivateConversation: (friendId) => controllable(calls.create, friendId),
    getMessages: (conversationId, signal) => controllable(calls.messages, conversationId, signal),
    sendMessage: (conversationId, content) => controllable(calls.send, { conversationId, content }),
  };

  return { api, calls };
}

function httpError(status: number): AxiosError {
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { detail: "nope" },
  });
}

const networkError = () => new AxiosError("Network Error", "ERR_NETWORK");

// ---- Test data. The signed-in user is id 1. ----

function user(id: number, name: string, username = name.toLowerCase()): PublicUser {
  return { id, name, username, bio: null, avatar_url: null };
}

const me = user(1, "Me");
const alice = user(2, "Alice");
const bob = user(3, "Bob");

function chat(id: number, participants: PublicUser[], type: "private" | "group" = "private"): Conversation {
  return { id, type, game_night_id: null, participants, created_at: "2026-11-01T10:00:00Z" };
}

const chatA = chat(10, [me, alice]);
const chatB = chat(20, [me, bob]);

let nextMessageId = 100;
function message(conversationId: number, userId: number, content: string, minute = 0): Message {
  return {
    id: nextMessageId++,
    conversation_id: conversationId,
    user_id: userId,
    content,
    created_at: `2026-11-20T10:${String(minute).padStart(2, "0")}:00Z`,
  };
}

/** The messages the page would render for the selected chat. */
function shown(state: ChatState): readonly Message[] {
  const thread = activeThread(state);
  return thread?.status === "success" ? thread.messages : [];
}

async function openStore(conversations: Conversation[] = [chatA, chatB]) {
  const { api, calls } = fakeApi();
  const store = new ChatStore(api);
  store.open("1|token");
  await calls.conversations[0].resolve(conversations);
  await calls.friends[0].resolve([alice, bob]);
  return { store, calls };
}

/** Selects `conversation` and answers its first load with `messages` (newest first). */
async function openChat(
  store: ChatStore,
  calls: ReturnType<typeof fakeApi>["calls"],
  conversation: Conversation,
  messages: Message[],
) {
  store.select(conversation.id);
  await calls.messages.at(-1)!.resolve(messages);
}

// ---- A. Switching conversations ----

describe("switching conversations", () => {
  test("hides the previous chat's messages immediately", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, [message(10, 2, "secret for A")]);
    expect(shown(store.getState()).map((m) => m.content)).toEqual(["secret for A"]);

    store.select(chatB.id);

    const thread = activeThread(store.getState());
    expect(thread?.conversationId).toBe(chatB.id);
    expect(thread?.status).toBe("loading");
    expect(thread?.messages).toEqual([]);
  });

  test("a late response from A can't overwrite B", async () => {
    const { store, calls } = await openStore();
    store.select(chatA.id);
    store.select(chatB.id);
    const [requestA, requestB] = calls.messages;

    expect(requestA.args).toBe(chatA.id);
    expect(requestA.signal?.aborted).toBe(true);

    await requestB.resolve([message(20, 3, "hi from B")]);
    await requestA.resolve([message(10, 2, "late A")]);

    const state = store.getState();
    expect(state.activeId).toBe(chatB.id);
    expect(shown(state).map((m) => m.content)).toEqual(["hi from B"]);
  });

  test("a failed request for B never shows A's messages", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, [message(10, 2, "secret for A")]);

    store.select(chatB.id);
    await calls.messages[1].reject(httpError(403));

    const thread = activeThread(store.getState());
    expect(thread?.conversationId).toBe(chatB.id);
    expect(thread?.status).toBe("error");
    expect(thread?.messages).toEqual([]);
    expect(thread?.error?.kind).toBe("forbidden");
  });

  test("an error from A's old request doesn't show as B's error", async () => {
    const { store, calls } = await openStore();
    store.select(chatA.id);
    store.select(chatB.id);

    await calls.messages[0].reject(httpError(500));
    expect(activeThread(store.getState())?.status).toBe("loading");

    await calls.messages[1].resolve([]);
    expect(activeThread(store.getState())?.status).toBe("success");
  });

  test("re-selecting the open chat doesn't reload it", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, []);
    store.select(chatA.id);
    expect(calls.messages).toHaveLength(1);
  });
});

// ---- B. Drafts and sending ----

describe("drafts and sending", () => {
  test("drafts are kept per conversation", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, []);
    store.setDraft(chatA.id, "draft for A");

    await openChat(store, calls, chatB, []);
    expect(store.getState().drafts[chatB.id]).toBeUndefined();
    store.setDraft(chatB.id, "draft for B");

    await openChat(store, calls, chatA, []);
    expect(store.getState().drafts[chatA.id]).toBe("draft for A");
    expect(store.getState().drafts[chatB.id]).toBe("draft for B");
  });

  test("send to A, switch to B, success: only A is updated", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatB, []);
    store.setDraft(chatB.id, "draft for B");
    await openChat(store, calls, chatA, []);
    store.setDraft(chatA.id, "  hello A  ");

    const sending = store.send(chatA.id);
    expect(calls.send[0].args).toEqual({ conversationId: chatA.id, content: "hello A" });
    expect(store.getState().drafts[chatA.id]).toBe("");

    store.select(chatB.id);
    const fromB = message(20, 3, "B's message");
    await calls.messages.at(-1)!.resolve([fromB]);

    await calls.send[0].resolve(message(10, 1, "hello A"));
    await sending;

    const state = store.getState();
    expect(state.activeId).toBe(chatB.id);
    expect(shown(state)).toEqual([fromB]);
    expect(state.drafts[chatB.id]).toBe("draft for B");
    expect(state.sending[chatA.id]).toBeUndefined();
    expect(state.sendFailures[chatB.id]).toBeUndefined();
  });

  test("send to A, switch to B, failure: the text goes back to A only", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatB, []);
    store.setDraft(chatB.id, "draft for B");
    await openChat(store, calls, chatA, []);
    store.setDraft(chatA.id, "hello A");

    const sending = store.send(chatA.id);
    store.select(chatB.id);
    await calls.messages.at(-1)!.resolve([]);
    await calls.send[0].reject(networkError());
    await sending;

    const state = store.getState();
    expect(state.drafts[chatA.id]).toBe("hello A");
    expect(state.drafts[chatB.id]).toBe("draft for B");
    expect(state.sendFailures[chatA.id]).toMatchObject({ unsent: null });
    expect(state.sendFailures[chatB.id]).toBeUndefined();
    expect(shown(state)).toEqual([]);
  });

  test("a failed send doesn't overwrite text typed while it was pending", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, []);
    store.setDraft(chatA.id, "first");

    const sending = store.send(chatA.id);
    store.setDraft(chatA.id, "typed meanwhile");
    await calls.send[0].reject(httpError(500));
    await sending;

    const state = store.getState();
    expect(state.drafts[chatA.id]).toBe("typed meanwhile");
    expect(state.sendFailures[chatA.id]?.unsent).toBe("first");

    // Retry sends the kept text, not the new draft.
    void store.retrySend(chatA.id);
    expect(calls.send[1].args).toEqual({ conversationId: chatA.id, content: "first" });
    expect(store.getState().drafts[chatA.id]).toBe("typed meanwhile");
  });

  test("rapid repeated sends only post once", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, []);
    store.setDraft(chatA.id, "once");

    void store.send(chatA.id);
    store.setDraft(chatA.id, "again");
    void store.send(chatA.id);
    void store.send(chatA.id);

    expect(calls.send).toHaveLength(1);
  });

  test("empty, whitespace-only and too-long messages aren't sent", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, []);

    store.setDraft(chatA.id, "   \n ");
    await store.send(chatA.id);
    await store.send(chatB.id); // no draft at all

    store.setDraft(chatA.id, "x".repeat(2001));
    await store.send(chatA.id);

    expect(calls.send).toHaveLength(0);
    expect(store.getState().sendFailures[chatA.id]?.message).toContain("2000");
    expect(store.getState().drafts[chatA.id]).toHaveLength(2001);
  });

  test("a successful send appears in the open chat once", async () => {
    const { store, calls } = await openStore();
    const first = message(10, 2, "hi", 1);
    await openChat(store, calls, chatA, [first]);
    store.setDraft(chatA.id, "hey");

    const sending = store.send(chatA.id);
    const sent = message(10, 1, "hey", 2);
    await calls.send[0].resolve(sent);
    await sending;

    store.poll();
    await calls.messages.at(-1)!.resolve([sent, first]);

    expect(shown(store.getState())).toEqual([first, sent]);
  });
});

// ---- C. Polling ----

describe("polling", () => {
  test("doesn't start a GET while one for the chat is still running", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, []);

    store.poll();
    store.poll();
    store.poll();
    expect(calls.messages).toHaveLength(2);

    await calls.messages[1].resolve([]);
    store.poll();
    expect(calls.messages).toHaveLength(3);
  });

  test("doesn't poll while the first load is running or after it failed", async () => {
    const { store, calls } = await openStore();
    store.select(chatA.id);
    store.poll();
    expect(calls.messages).toHaveLength(1);

    await calls.messages[0].reject(httpError(500));
    store.poll();
    expect(calls.messages).toHaveLength(1);
  });

  test("a poll started before a send can't remove the sent message", async () => {
    const { store, calls } = await openStore();
    const first = message(10, 2, "hi", 1);
    await openChat(store, calls, chatA, [first]);

    store.poll(); // started before the send
    store.setDraft(chatA.id, "my reply");
    const sending = store.send(chatA.id);
    const sent = message(10, 1, "my reply", 2);
    await calls.send[0].resolve(sent);
    await sending;

    await calls.messages[1].resolve([first]);

    expect(shown(store.getState())).toEqual([first, sent]);
  });

  test("an unchanged poll doesn't notify or replace the list", async () => {
    const { store, calls } = await openStore();
    const list = [message(10, 2, "b", 2), message(10, 1, "a", 1)];
    await openChat(store, calls, chatA, list);
    const before = store.getState();

    let notified = 0;
    store.subscribe(() => notified++);
    store.poll();
    await calls.messages[1].resolve([...list]);

    expect(notified).toBe(0);
    expect(store.getState()).toBe(before);
  });

  test("merges new messages oldest first without duplicates", async () => {
    const { store, calls } = await openStore();
    const one = message(10, 2, "one", 1);
    const two = message(10, 1, "two", 2);
    await openChat(store, calls, chatA, [two, one]); // backend order: newest first

    const three = message(10, 2, "three", 3);
    store.poll();
    await calls.messages[1].resolve([three, two, one]);

    expect(shown(store.getState()).map((m) => m.content)).toEqual(["one", "two", "three"]);
  });

  test("keeps messages through a failed refresh and warns once it keeps failing", async () => {
    const { store, calls } = await openStore();
    const first = message(10, 2, "hi");
    await openChat(store, calls, chatA, [first]);

    store.poll();
    await calls.messages[1].reject(networkError());
    store.poll();
    await calls.messages[2].reject(networkError());

    let thread = activeThread(store.getState());
    expect(thread?.status).toBe("success");
    expect(thread?.messages).toEqual([first]);
    expect(thread?.refreshFailures).toBe(2);

    store.poll();
    await calls.messages[3].resolve([first]);
    thread = activeThread(store.getState());
    expect(thread?.refreshFailures).toBe(0);
  });

  test("a 403 during polling hides the messages", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, [message(10, 2, "hi")]);

    store.poll();
    await calls.messages[1].reject(httpError(403));

    const thread = activeThread(store.getState());
    expect(thread?.status).toBe("error");
    expect(thread?.messages).toEqual([]);
  });

  test("drops messages that belong to another conversation", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, [message(20, 3, "for B"), message(10, 2, "for A")]);
    expect(shown(store.getState()).map((m) => m.content)).toEqual(["for A"]);
  });
});

// ---- D. Errors and starting chats ----

describe("loading errors", () => {
  test("a failed chat list is an error with Retry, not an empty list", async () => {
    const { api, calls } = fakeApi();
    const store = new ChatStore(api);
    store.open("1|token");
    await calls.conversations[0].reject(networkError());

    expect(store.getState().conversations).toMatchObject({ status: "error" });

    void store.loadConversations();
    expect(store.getState().conversations.status).toBe("loading");
    await calls.conversations[1].resolve([chatA]);
    expect(store.getState().conversations).toEqual({ status: "success", data: [chatA] });
  });

  test("a failed friends list is an error with Retry, not 'no friends'", async () => {
    const { api, calls } = fakeApi();
    const store = new ChatStore(api);
    store.open("1|token");
    await calls.friends[0].reject(httpError(500));
    expect(store.getState().friends.status).toBe("error");

    void store.loadFriends();
    await calls.friends[1].resolve([alice]);
    expect(store.getState().friends).toEqual({ status: "success", data: [alice] });
  });

  test("a failed message load can be retried", async () => {
    const { store, calls } = await openStore();
    store.select(chatA.id);
    await calls.messages[0].reject(networkError());
    expect(activeThread(store.getState())?.status).toBe("error");

    store.retryMessages();
    expect(activeThread(store.getState())?.status).toBe("loading");
    await calls.messages[1].resolve([message(10, 2, "back")]);
    expect(shown(store.getState())).toHaveLength(1);
  });

  test("an older chat-list response can't overwrite a newer one", async () => {
    const { api, calls } = fakeApi();
    const store = new ChatStore(api);
    store.open("1|token");
    void store.loadConversations();

    await calls.conversations[1].resolve([chatA, chatB]);
    await calls.conversations[0].resolve([chatA]);

    expect(store.getState().conversations).toEqual({ status: "success", data: [chatA, chatB] });
  });
});

describe("starting a chat", () => {
  test("reuses an existing private chat without a request", async () => {
    const { store, calls } = await openStore();
    expect(await store.startChat(alice)).toBe(true);
    expect(calls.create).toHaveLength(0);
    expect(store.getState().activeId).toBe(chatA.id);
  });

  test("creates a chat by friend id and selects it", async () => {
    const { store, calls } = await openStore([chatA]);
    const started = store.startChat(bob);
    expect(calls.create[0].args).toBe(bob.id);

    await calls.create[0].resolve(chatB);
    expect(await started).toBe(true);

    const state = store.getState();
    expect(state.activeId).toBe(chatB.id);
    expect(state.conversations).toEqual({ status: "success", data: [chatB, chatA] });
    expect(state.startingWith).toBeNull();
  });

  test("ignores repeated clicks while a chat is being created", async () => {
    const { store, calls } = await openStore([chatA]);
    void store.startChat(bob);
    expect(await store.startChat(bob)).toBe(false);
    expect(calls.create).toHaveLength(1);
  });

  test("409 opens the existing chat after reloading the list", async () => {
    const { store, calls } = await openStore([chatA]);
    const started = store.startChat(bob);
    await calls.create[0].reject(httpError(409));
    await calls.conversations[1].resolve([chatA, chatB]);

    expect(await started).toBe(true);
    expect(store.getState().activeId).toBe(chatB.id);
    expect(store.getState().startError).toBeNull();
  });

  test("409 with a failing reload reports the error instead of rejecting", async () => {
    const { store, calls } = await openStore([chatA]);
    const started = store.startChat(bob);
    await calls.create[0].reject(httpError(409));
    await calls.conversations[1].reject(networkError());

    // Resolves (no unhandled rejection) and leaves a retryable error.
    expect(await started).toBe(false);
    const state = store.getState();
    expect(state.startError?.friendId).toBe(bob.id);
    expect(state.startError?.message).toContain("couldn't be loaded");
    expect(state.startingWith).toBeNull();
    // The list that was shown stays.
    expect(state.conversations).toEqual({ status: "success", data: [chatA] });
  });

  test("409 when the reloaded list still lacks the chat says so", async () => {
    const { store, calls } = await openStore([chatA]);
    const started = store.startChat(bob);
    await calls.create[0].reject(httpError(409));
    await calls.conversations[1].resolve([chatA]);

    expect(await started).toBe(false);
    expect(store.getState().startError?.message).toContain("couldn't be opened");
  });

  test("other failures show a message", async () => {
    const { store, calls } = await openStore([chatA]);
    const started = store.startChat(bob);
    await calls.create[0].reject(httpError(403));

    expect(await started).toBe(false);
    expect(store.getState().startError?.message).toBe("You can only message accepted friends.");
  });

  test("starting a chat keeps other chats' drafts", async () => {
    const { store, calls } = await openStore([chatA]);
    await openChat(store, calls, chatA, []);
    store.setDraft(chatA.id, "keep me");

    const started = store.startChat(bob);
    await calls.create[0].resolve(chatB);
    await started;

    expect(store.getState().drafts[chatA.id]).toBe("keep me");
    expect(store.getState().drafts[chatB.id]).toBeUndefined();
  });
});

// ---- Sign-out and account changes ----

describe("scope", () => {
  test("closing drops all data and late responses can't write", async () => {
    const { store, calls } = await openStore();
    store.select(chatA.id);
    store.setDraft(chatA.id, "draft");
    const sending = store.send(chatA.id);

    store.close();
    await calls.messages[0].resolve([message(10, 2, "old user's message")]);
    await calls.send[0].resolve(message(10, 1, "draft"));
    await sending;

    expect(store.getState()).toMatchObject({
      activeId: null,
      thread: null,
      drafts: {},
      conversations: { status: "loading" },
    });
  });

  test("a send from the previous user can't land in the next user's open chat", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, []);
    store.setDraft(chatA.id, "from user 1");
    const sending = store.send(chatA.id);

    // Another account signs in and opens a chat with the same id.
    store.open("2|other-token");
    await calls.conversations[1].resolve([chatA]);
    await openChat(store, calls, chatA, []);

    await calls.send[0].reject(networkError());
    await sending;
    expect(store.getState().drafts[chatA.id]).toBeUndefined();
    expect(store.getState().sendFailures[chatA.id]).toBeUndefined();

    const second = store.send(chatA.id); // nothing to send for user 2
    await second;
    expect(calls.send).toHaveLength(1);
  });

  test("a confirmed send from the previous user isn't shown to the next user", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, []);
    store.setDraft(chatA.id, "from user 1");
    const sending = store.send(chatA.id);

    store.open("2|other-token");
    await calls.conversations[1].resolve([chatA]);
    await openChat(store, calls, chatA, []);

    await calls.send[0].resolve(message(10, 1, "from user 1"));
    await sending;
    expect(shown(store.getState())).toEqual([]);
  });

  test("opening another user's scope starts empty and ignores the previous user's requests", async () => {
    const { store, calls } = await openStore();
    await openChat(store, calls, chatA, [message(10, 2, "for user 1")]);
    store.poll();

    store.open("2|other-token");
    await calls.messages[1].resolve([message(10, 2, "late for user 1")]);

    const state = store.getState();
    expect(state.activeId).toBeNull();
    expect(state.thread).toBeNull();
    expect(state.conversations.status).toBe("loading");
    expect(calls.conversations).toHaveLength(2);
  });
});
