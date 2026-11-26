/**
 * State and request bookkeeping for the Messages page.
 *
 * Framework-free so the race handling can be tested without a DOM; useMessages
 * subscribes to it with useSyncExternalStore (same pattern as NightResource).
 *
 * Guarantees:
 * - The thread (loaded messages) is tagged with its conversation id and is replaced,
 *   empty, the moment another chat is selected. A message list is never shown under
 *   a chat it doesn't belong to, even when the new chat's request fails.
 * - Message GETs for a chat that is no longer selected are aborted and, if they still
 *   resolve, ignored. At most one GET runs for the selected chat, so polls can't overlap.
 * - Responses are merged by message id (messages can't be edited or deleted), so a poll
 *   that started before a send can't remove the sent message.
 * - Drafts, "sending" flags and send errors are kept per conversation id. A send always
 *   targets the id captured at submit time, and its result only touches that chat.
 * - Everything belongs to a scope (signed-in user + token). `open` with a new scope or
 *   `close` drops all data and makes every request still running unable to write.
 * - Public methods never reject, so click handlers can't cause unhandled rejections.
 */
import { getApiErrorInfo, type ApiErrorInfo } from "@/api/errors";
import { MAX_MESSAGE_LENGTH } from "@/api/conversations";
import { chatErrorMessage, findPrivateChatWith } from "@/lib/messages/display";
import { mergeMessages } from "@/lib/messages/thread";
import type { Conversation, Message } from "@/types/conversation";
import type { PublicUser } from "@/types/friend";

export interface ChatApi {
  getConversations(signal?: AbortSignal): Promise<Conversation[]>;
  getFriends(): Promise<PublicUser[]>;
  createPrivateConversation(friendId: number): Promise<Conversation>;
  /** Newest first, as the backend returns them. */
  getMessages(conversationId: number, signal?: AbortSignal): Promise<Message[]>;
  sendMessage(conversationId: number, content: string): Promise<Message>;
}

export type Loadable<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiErrorInfo }
  | { status: "success"; data: T };

/** The selected chat's messages. Only ever describes `conversationId`. */
export interface Thread {
  conversationId: number;
  status: "loading" | "error" | "success";
  /** Oldest first. Empty while loading (except own messages sent meanwhile) and on error. */
  messages: readonly Message[];
  error: ApiErrorInfo | null;
  /** Background refreshes that failed in a row while messages are shown. */
  refreshFailures: number;
}

export interface SendFailure {
  message: string;
  /**
   * The text that wasn't sent, when it couldn't go back into the draft because the
   * user had typed something new meanwhile. Null when it was put back into the draft.
   */
  unsent: string | null;
}

export interface StartError {
  friendId: number;
  message: string;
}

export interface ChatState {
  conversations: Loadable<readonly Conversation[]>;
  friends: Loadable<readonly PublicUser[]>;
  activeId: number | null;
  thread: Thread | null;
  drafts: Readonly<Record<number, string>>;
  sending: Readonly<Record<number, boolean>>;
  sendFailures: Readonly<Record<number, SendFailure>>;
  /** Friend id while a new chat with them is being created. */
  startingWith: number | null;
  startError: StartError | null;
}

export const INITIAL_CHAT_STATE: ChatState = {
  conversations: { status: "loading" },
  friends: { status: "loading" },
  activeId: null,
  thread: null,
  drafts: {},
  sending: {},
  sendFailures: {},
  startingWith: null,
  startError: null,
};

/** Background refreshes may fail this many times in a row before the page says so. */
export const REFRESH_FAILURES_BEFORE_WARNING = 2;

/** The selected chat's messages, or null when the thread isn't for that chat. */
export function activeThread(state: ChatState): Thread | null {
  return state.thread && state.thread.conversationId === state.activeId ? state.thread : null;
}

/** Errors that mean the user may not see this chat's messages anymore. */
function revokesAccess(error: ApiErrorInfo): boolean {
  return error.kind === "forbidden" || error.kind === "not_found" || error.kind === "unauthorized";
}

function without<T>(record: Readonly<Record<number, T>>, key: number): Record<number, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

/** Unicode code points, like the backend's Python `len`. */
function characterCount(text: string): number {
  return [...text].length;
}

export class ChatStore {
  private state: ChatState = INITIAL_CHAT_STATE;
  private readonly listeners = new Set<() => void>();

  /** Identity of the current scope; requests capture it and only write while it's unchanged. */
  private session: object | null = null;
  private scope: string | null = null;

  /** The message GET for the selected chat that may still write (load, retry or poll). */
  private threadRequest: { controller: AbortController } | null = null;
  /** Bumped by every conversation-list request; only the newest may write. */
  private conversationsRequest = 0;
  private friendsRequest = 0;
  private sessionController: AbortController | null = null;

  constructor(private readonly api: ChatApi) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): ChatState => this.state;

  /** Starts serving `scope` (user + token). A different scope starts from scratch. */
  open(scope: string): void {
    if (this.scope === scope && this.session !== null) return;
    this.close();
    this.scope = scope;
    this.session = {};
    this.sessionController = new AbortController();
    void this.loadConversations();
    void this.loadFriends();
  }

  /** Stops serving the current scope (unmount, sign-out, account change). */
  close(): void {
    this.abortThread();
    this.sessionController?.abort();
    this.sessionController = null;
    this.session = null;
    this.scope = null;
    this.conversationsRequest++;
    this.friendsRequest++;
    this.set(INITIAL_CHAT_STATE);
  }

  // ---- Conversation list -------------------------------------------------------------

  /** Loads (or with Retry reloads) the chat list, showing the loading state meanwhile. */
  async loadConversations(): Promise<void> {
    if (this.session === null) return;
    this.set({ conversations: { status: "loading" } });
    const result = await this.fetchConversations();
    if (result !== null && !Array.isArray(result)) {
      this.set({ conversations: { status: "error", error: result } });
    }
  }

  /**
   * Fetches the list and stores it on success. Returns the list, the error, or null when
   * a newer request or another scope took over. Never rejects.
   */
  private async fetchConversations(): Promise<Conversation[] | ApiErrorInfo | null> {
    const session = this.session;
    const signal = this.sessionController?.signal;
    if (session === null) return null;
    const request = ++this.conversationsRequest;

    try {
      const conversations = await this.api.getConversations(signal);
      if (session !== this.session || request !== this.conversationsRequest) return null;
      this.set({ conversations: { status: "success", data: conversations } });

      // The selected chat is no longer available: deselect it rather than keep polling it.
      const { activeId } = this.state;
      if (activeId !== null && !conversations.some((conversation) => conversation.id === activeId)) {
        this.abortThread();
        this.set({ activeId: null, thread: null });
      }
      return conversations;
    } catch (error: unknown) {
      if (session !== this.session || request !== this.conversationsRequest) return null;
      const info = getApiErrorInfo(error);
      return info.kind === "canceled" ? null : info;
    }
  }

  // ---- Friends -----------------------------------------------------------------------

  async loadFriends(): Promise<void> {
    const session = this.session;
    if (session === null) return;
    const request = ++this.friendsRequest;
    this.set({ friends: { status: "loading" } });

    try {
      const friends = await this.api.getFriends();
      if (session !== this.session || request !== this.friendsRequest) return;
      this.set({ friends: { status: "success", data: friends } });
    } catch (error: unknown) {
      if (session !== this.session || request !== this.friendsRequest) return;
      const info = getApiErrorInfo(error);
      if (info.kind !== "canceled") this.set({ friends: { status: "error", error: info } });
    }
  }

  // ---- Selecting and loading a chat --------------------------------------------------

  /** Selects a chat. Its thread starts empty, so no other chat's messages can show. */
  select(conversationId: number): void {
    if (this.session === null) return;
    const current = activeThread(this.state);
    if (this.state.activeId === conversationId && current && current.status !== "error") return;
    this.startThread(conversationId);
  }

  /** Retry after a failed load: shows the loading state and fetches again. */
  retryMessages(): void {
    const { activeId } = this.state;
    if (this.session === null || activeId === null) return;
    this.startThread(activeId);
  }

  /**
   * Background refresh of the selected chat (the 5-second poll, or "Retry now").
   * Skipped while another GET for it is still running, so requests never overlap.
   */
  poll(): void {
    const thread = activeThread(this.state);
    if (this.session === null || !thread || thread.status !== "success") return;
    if (this.threadRequest !== null) return;
    void this.fetchMessages(thread.conversationId, true);
  }

  private startThread(conversationId: number): void {
    this.abortThread();
    this.set({
      activeId: conversationId,
      thread: { conversationId, status: "loading", messages: [], error: null, refreshFailures: 0 },
    });
    void this.fetchMessages(conversationId, false);
  }

  private abortThread(): void {
    this.threadRequest?.controller.abort();
    this.threadRequest = null;
  }

  private async fetchMessages(conversationId: number, background: boolean): Promise<void> {
    const session = this.session;
    if (session === null) return;
    const request = { controller: new AbortController() };
    this.threadRequest = request;

    // Writes only while this is still the selected chat's current request.
    const current = () =>
      session === this.session &&
      request === this.threadRequest &&
      this.state.activeId === conversationId &&
      this.state.thread?.conversationId === conversationId
        ? this.state.thread
        : null;

    try {
      const incoming = await this.api.getMessages(conversationId, request.controller.signal);
      const thread = current();
      if (!thread) return;

      const messages = mergeMessages(thread.messages, incoming, conversationId);
      const unchanged =
        thread.status === "success" && messages === thread.messages && thread.refreshFailures === 0;
      if (unchanged) return; // nothing new: keep the same state so nothing re-renders

      this.setThread({ ...thread, status: "success", messages, error: null, refreshFailures: 0 });
    } catch (error: unknown) {
      const thread = current();
      if (!thread) return;
      const info = getApiErrorInfo(error);
      if (info.kind === "canceled") return;

      if (background && thread.status === "success" && !revokesAccess(info)) {
        // Keep showing this chat's messages; say so only once it keeps failing.
        this.setThread({ ...thread, refreshFailures: thread.refreshFailures + 1 });
      } else {
        // Never leave messages on screen the user may no longer be allowed to see.
        this.setThread({ ...thread, status: "error", messages: [], error: info, refreshFailures: 0 });
      }
    } finally {
      if (this.threadRequest === request) this.threadRequest = null;
    }
  }

  private setThread(thread: Thread): void {
    this.set({ thread });
  }

  // ---- Drafts and sending ------------------------------------------------------------

  setDraft(conversationId: number, text: string): void {
    if (this.session === null) return;
    this.set({ drafts: { ...this.state.drafts, [conversationId]: text } });
  }

  /** Sends `conversationId`'s draft to `conversationId`, whatever is selected later. */
  async send(conversationId: number): Promise<void> {
    if (this.session === null || this.state.sending[conversationId]) return;
    const content = (this.state.drafts[conversationId] ?? "").trim();
    if (!content) return;

    if (characterCount(content) > MAX_MESSAGE_LENGTH) {
      this.set({
        sendFailures: {
          ...this.state.sendFailures,
          [conversationId]: {
            message: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`,
            unsent: null,
          },
        },
      });
      return;
    }

    await this.deliver(conversationId, content, true);
  }

  /** Sends the text kept from a failed send again (see SendFailure.unsent). */
  async retrySend(conversationId: number): Promise<void> {
    const unsent = this.state.sendFailures[conversationId]?.unsent;
    if (this.session === null || !unsent || this.state.sending[conversationId]) return;
    await this.deliver(conversationId, unsent, false);
  }

  dismissSendFailure(conversationId: number): void {
    if (!this.state.sendFailures[conversationId]) return;
    this.set({ sendFailures: without(this.state.sendFailures, conversationId) });
  }

  private async deliver(conversationId: number, content: string, fromDraft: boolean): Promise<void> {
    const session = this.session;
    this.set({
      sending: { ...this.state.sending, [conversationId]: true },
      sendFailures: without(this.state.sendFailures, conversationId),
      ...(fromDraft ? { drafts: { ...this.state.drafts, [conversationId]: "" } } : {}),
    });

    try {
      const message = await this.api.sendMessage(conversationId, content);
      if (session !== this.session) return;

      // Only the chat it was sent to, and only if that chat's thread is the one held.
      const thread = this.state.thread;
      const changes: Partial<ChatState> = { sending: without(this.state.sending, conversationId) };
      if (thread && thread.conversationId === conversationId && thread.status !== "error") {
        changes.thread = {
          ...thread,
          messages: mergeMessages(thread.messages, [message], conversationId),
        };
      }
      this.set(changes);
    } catch (error: unknown) {
      if (session !== this.session) return;
      const text = chatErrorMessage(getApiErrorInfo(error), "send");
      const draftNow = this.state.drafts[conversationId] ?? "";
      // Put the text back only if that chat's draft is still empty; never overwrite new typing.
      const restore = draftNow.trim() === "";

      this.set({
        sending: without(this.state.sending, conversationId),
        sendFailures: {
          ...this.state.sendFailures,
          [conversationId]: { message: text, unsent: restore ? null : content },
        },
        ...(restore ? { drafts: { ...this.state.drafts, [conversationId]: content } } : {}),
      });
    }
  }

  // ---- Starting a private chat -------------------------------------------------------

  /**
   * Opens the private chat with `friend`, creating it if needed.
   * Resolves true when a chat was selected. Never rejects.
   */
  async startChat(friend: PublicUser): Promise<boolean> {
    const session = this.session;
    if (session === null || this.state.startingWith !== null) return false;
    this.set({ startError: null });

    const list = this.state.conversations;
    const existing = list.status === "success" ? findPrivateChatWith(list.data, friend.id) : undefined;
    if (existing) {
      this.select(existing.id);
      return true;
    }

    this.set({ startingWith: friend.id });
    try {
      const conversation = await this.api.createPrivateConversation(friend.id);
      if (session !== this.session) return false;
      this.addConversation(conversation);
      this.select(conversation.id);
      return true;
    } catch (error: unknown) {
      if (session !== this.session) return false;
      const info = getApiErrorInfo(error);
      if (info.kind !== "conflict") {
        this.failStart(friend, chatErrorMessage(info, "start"));
        return false;
      }
      return await this.recoverExistingChat(session, friend);
    } finally {
      if (session === this.session) this.set({ startingWith: null });
    }
  }

  /** 409: the chat already exists but isn't in the local list. Reload and open it. */
  private async recoverExistingChat(session: object, friend: PublicUser): Promise<boolean> {
    const result = await this.fetchConversations();
    if (session !== this.session) return false;

    if (Array.isArray(result)) {
      const match = findPrivateChatWith(result, friend.id);
      if (match) {
        this.select(match.id);
        return true;
      }
      this.failStart(
        friend,
        `You already have a chat with ${friend.name}, but it couldn't be opened. Please try again.`,
      );
      return false;
    }

    this.failStart(
      friend,
      result === null
        ? `You already have a chat with ${friend.name}. Please try again.`
        : `You already have a chat with ${friend.name}, but your chats couldn't be loaded. ${chatErrorMessage(result, "load-chats")}`,
    );
    return false;
  }

  private addConversation(conversation: Conversation): void {
    const list = this.state.conversations;
    if (list.status !== "success") {
      // The list failed or is loading: reload it rather than show a partial list.
      void this.loadConversations();
      return;
    }
    if (list.data.some((item) => item.id === conversation.id)) return;
    // A list GET still running started before this chat existed: it may not overwrite.
    this.conversationsRequest++;
    this.set({ conversations: { status: "success", data: [conversation, ...list.data] } });
  }

  private failStart(friend: PublicUser, message: string): void {
    this.set({ startError: { friendId: friend.id, message } });
  }

  dismissStartError(): void {
    if (this.state.startError) this.set({ startError: null });
  }

  // ---- Internals ---------------------------------------------------------------------

  private set(changes: Partial<ChatState>): void {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener();
  }
}
