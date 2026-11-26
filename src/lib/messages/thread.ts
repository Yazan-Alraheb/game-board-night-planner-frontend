/**
 * Pure helpers for one chat's message list. Framework-free so they run under bun:test.
 */
import type { Message } from "@/types/conversation";

/** Oldest first; ties on created_at are broken by id (the backend's own tiebreak). */
export function compareMessages(a: Message, b: Message): number {
  const byTime = Date.parse(a.created_at) - Date.parse(b.created_at);
  return byTime !== 0 && !Number.isNaN(byTime) ? byTime : a.id - b.id;
}

/**
 * Adds `incoming` to `current` (both may be in any order) and returns them oldest first.
 *
 * - Messages can't be edited or deleted on the backend, so a message id seen once stays
 *   valid: merging is a union by id. A response that started before a send therefore
 *   can't remove the sent message, and an older poll can't undo a newer one.
 * - Messages that belong to another conversation are dropped.
 * - Returns `current` itself when nothing is new, so unchanged polls don't re-render.
 */
export function mergeMessages(
  current: readonly Message[],
  incoming: readonly Message[],
  conversationId: number,
): readonly Message[] {
  const seen = new Set(current.map((message) => message.id));
  const added: Message[] = [];

  for (const message of incoming) {
    if (message.conversation_id !== conversationId || seen.has(message.id)) continue;
    seen.add(message.id);
    added.push(message);
  }

  if (added.length === 0) return current;
  return [...current, ...added].sort(compareMessages);
}

/** What the message list showed at one render. */
export interface ThreadView {
  conversationId: number;
  /** The first load finished (an empty chat counts as loaded). */
  loaded: boolean;
  lastMessageId: number | null;
}

export function threadView(
  conversationId: number,
  loaded: boolean,
  messages: readonly Message[],
): ThreadView {
  return { conversationId, loaded, lastMessageId: messages.at(-1)?.id ?? null };
}

/** True when the previous render showed nothing loaded for this conversation yet. */
function isFirstLoad(previous: ThreadView | null, next: ThreadView): boolean {
  return !previous || previous.conversationId !== next.conversationId || !previous.loaded;
}

/**
 * Whether the message list should jump to the newest message after a render.
 * - First load of a chat: yes.
 * - Nothing new at the end (e.g. an unchanged poll): no.
 * - The newest message is the user's own (they just sent it): yes.
 * - Someone else's new message: only when the reader was already near the bottom,
 *   so someone reading older messages isn't pulled down.
 */
export function shouldScrollToBottom(
  previous: ThreadView | null,
  next: ThreadView,
  newestIsMine: boolean,
  wasNearBottom: boolean,
): boolean {
  if (!next.loaded || next.lastMessageId === null) return false;
  if (isFirstLoad(previous, next)) return true;
  if (previous!.lastMessageId === next.lastMessageId) return false;
  return newestIsMine || wasNearBottom;
}

/** Within this many pixels of the end counts as "at the bottom". */
export const NEAR_BOTTOM_PX = 80;

export function isNearBottom(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight <= NEAR_BOTTOM_PX;
}

/**
 * Messages from other people that arrived since the previous render, for a screen-reader
 * announcement. Empty on a chat's first load so the history isn't read out.
 */
export function incomingSince(
  previous: ThreadView | null,
  next: ThreadView,
  messages: readonly Message[],
  myId: number | null,
): Message[] {
  if (!next.loaded || isFirstLoad(previous, next)) return [];
  if (previous!.lastMessageId === next.lastMessageId) return [];

  const start =
    previous!.lastMessageId === null
      ? 0
      : messages.findIndex((message) => message.id === previous!.lastMessageId) + 1;

  return messages.slice(start).filter((message) => message.user_id !== myId);
}
