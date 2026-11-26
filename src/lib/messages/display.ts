/**
 * Pure display helpers for the Messages page.
 */
import type { ApiErrorInfo } from "@/api/errors";
import type { Conversation } from "@/types/conversation";
import type { PublicUser } from "@/types/friend";

/** Everyone in the chat except the current user, identified by numeric id. */
export function otherParticipants(conversation: Conversation, myId: number | null): PublicUser[] {
  return conversation.participants.filter((person) => person.id !== myId);
}

/** The other person's name for a private chat, the members' names for a group. */
export function conversationTitle(conversation: Conversation, myId: number | null): string {
  return (
    otherParticipants(conversation, myId)
      .map((person) => person.name)
      .join(", ") || "Just you"
  );
}

export function conversationKind(conversation: Conversation): string {
  if (conversation.game_night_id !== null) return "Game night chat";
  return conversation.type === "group" ? "Group" : "Direct message";
}

/** "@username" when the user has one, otherwise null. */
export function handle(person: Pick<PublicUser, "username"> | undefined): string | null {
  const username = person?.username?.trim();
  return username ? `@${username}` : null;
}

/** The existing private chat with `friendId`, if any. */
export function findPrivateChatWith(
  conversations: readonly Conversation[],
  friendId: number,
): Conversation | undefined {
  return conversations.find(
    (conversation) =>
      conversation.type === "private" &&
      conversation.participants.some((person) => person.id === friendId),
  );
}

/** Whether bubbles need a sender label: any chat that isn't one-to-one. */
export function showsSenders(conversation: Conversation): boolean {
  return conversation.type === "group" || conversation.game_night_id !== null;
}

/**
 * Who sent a message, from the participants the backend returned.
 * Null when that user isn't among them (e.g. they left): nothing is made up.
 */
export function findSender(conversation: Conversation, userId: number): PublicUser | null {
  return conversation.participants.find((person) => person.id === userId) ?? null;
}

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const DAY_TIME: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", ...TIME };
const FULL: Intl.DateTimeFormatOptions = { year: "numeric", ...DAY_TIME };

/**
 * Formats in the current local time zone. The formatter is made per call (not once at
 * module load) so it always uses the same zone as the Date comparisons below; ChatPane
 * memoizes the rendered list, so this only runs when messages actually change.
 */
function format(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/** "3:42 PM" today, "Nov 24, 3:42 PM" earlier this year, with the year otherwise. */
export function formatMessageTime(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  if (date.toDateString() === now.toDateString()) return format(date, TIME);
  if (date.getFullYear() === now.getFullYear()) return format(date, DAY_TIME);
  return format(date, FULL);
}

/** Always with the date, for the timestamp's tooltip. */
export function formatFullMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? "" : format(date, FULL);
}

export type ChatAction = "load-chats" | "load-friends" | "load-messages" | "send" | "start";

const FALLBACK: Record<ChatAction, string> = {
  "load-chats": "Unable to load your chats.",
  "load-friends": "Unable to load your friends.",
  "load-messages": "Unable to load messages.",
  send: "Message failed to send.",
  start: "Unable to start a conversation.",
};

/** User-facing text for a failed request. Only status and kind are read, never headers. */
export function chatErrorMessage(error: ApiErrorInfo, action: ChatAction): string {
  switch (error.kind) {
    case "unauthorized":
      return "Your session has expired. Please log in again.";
    case "network":
      return `${FALLBACK[action]} Check your connection and try again.`;
    case "forbidden":
      if (action === "start") return "You can only message accepted friends.";
      if (action === "load-messages" || action === "send") {
        return "You no longer have access to this chat.";
      }
      break;
    case "not_found":
      if (action === "start") return "That person couldn't be found.";
      if (action === "load-messages" || action === "send") return "This chat no longer exists.";
      break;
    case "validation":
      if (action === "send") return "Messages need 1–2000 characters and can't be only spaces.";
      break;
  }
  return `${FALLBACK[action]} Please try again.`;
}
