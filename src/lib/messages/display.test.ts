/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import {
  chatErrorMessage,
  conversationKind,
  conversationTitle,
  findPrivateChatWith,
  findSender,
  formatMessageTime,
  handle,
  otherParticipants,
  showsSenders,
} from "@/lib/messages/display";
import type { Conversation } from "@/types/conversation";
import type { PublicUser } from "@/types/friend";

function user(id: number, name: string, username = name.toLowerCase()): PublicUser {
  return { id, name, username, bio: null, avatar_url: null };
}

const me = user(1, "Sam");
// Two friends with the same display name, told apart by username and id.
const alexA = user(2, "Alex", "alex_a");
const alexB = user(3, "Alex", "alex_b");

function chat(id: number, participants: PublicUser[], extra: Partial<Conversation> = {}): Conversation {
  return { id, type: "private", game_night_id: null, participants, created_at: "2026-11-01T10:00:00Z", ...extra };
}

describe("conversation titles", () => {
  test("a private chat is titled with the other person, never the current user", () => {
    expect(conversationTitle(chat(10, [me, alexA]), me.id)).toBe("Alex");
    expect(otherParticipants(chat(10, [me, alexA]), me.id)).toEqual([alexA]);
  });

  test("a group lists everyone else", () => {
    const group = chat(30, [me, alexA, user(4, "Kim")], { type: "group" });
    expect(conversationTitle(group, me.id)).toBe("Alex, Kim");
  });

  test("a chat with only the current user left", () => {
    expect(conversationTitle(chat(10, [me]), me.id)).toBe("Just you");
  });

  test("labels keep the existing wording", () => {
    expect(conversationKind(chat(10, [me, alexA]))).toBe("Direct message");
    expect(conversationKind(chat(30, [me, alexA], { type: "group" }))).toBe("Group");
    expect(conversationKind(chat(40, [me, alexA], { type: "group", game_night_id: 5 }))).toBe("Game night chat");
  });
});

describe("finding the private chat with a friend", () => {
  const chats = [
    chat(30, [me, alexB], { type: "group" }),
    chat(10, [me, alexA]),
    chat(20, [me, alexB]),
  ];

  test("matches by numeric id, not by display name, and ignores groups", () => {
    expect(findPrivateChatWith(chats, alexB.id)?.id).toBe(20);
    expect(findPrivateChatWith(chats, alexA.id)?.id).toBe(10);
    expect(findPrivateChatWith(chats, 99)).toBeUndefined();
  });
});

describe("senders", () => {
  const group = chat(30, [me, alexA, alexB], { type: "group" });

  test("group and game-night chats show senders; private chats don't", () => {
    expect(showsSenders(group)).toBe(true);
    expect(showsSenders(chat(40, [me, alexA], { type: "group", game_night_id: 5 }))).toBe(true);
    expect(showsSenders(chat(10, [me, alexA]))).toBe(false);
  });

  test("finds the sender by id among the returned participants", () => {
    expect(findSender(group, alexB.id)).toBe(alexB);
  });

  test("returns null for someone not among the participants instead of guessing", () => {
    expect(findSender(group, 99)).toBeNull();
  });
});

describe("handle", () => {
  test("formats usernames and tolerates missing ones", () => {
    expect(handle(alexA)).toBe("@alex_a");
    expect(handle({ username: "" })).toBeNull();
    expect(handle({ username: undefined as unknown as string })).toBeNull();
    expect(handle(undefined)).toBeNull();
  });
});

describe("formatMessageTime", () => {
  const now = new Date(2026, 10, 26, 15, 0);

  test("shows only the time for today", () => {
    expect(formatMessageTime(new Date(2026, 10, 26, 9, 5).toISOString(), now)).toBe("9:05 AM");
  });

  test("adds the date for earlier days", () => {
    expect(formatMessageTime(new Date(2026, 10, 24, 21, 30).toISOString(), now)).toBe("Nov 24, 9:30 PM");
    expect(formatMessageTime(new Date(2025, 0, 3, 8, 0).toISOString(), now)).toBe("Jan 3, 2025, 8:00 AM");
  });

  test("returns nothing for an invalid date", () => {
    expect(formatMessageTime("not a date", now)).toBe("");
  });
});

describe("chatErrorMessage", () => {
  const info = (kind: Parameters<typeof chatErrorMessage>[0]["kind"], status: number | null = null) => ({
    kind,
    status,
    detail: "backend text",
  });

  test("access errors explain themselves per action", () => {
    expect(chatErrorMessage(info("forbidden", 403), "load-messages")).toBe("You no longer have access to this chat.");
    expect(chatErrorMessage(info("not_found", 404), "send")).toBe("This chat no longer exists.");
    expect(chatErrorMessage(info("forbidden", 403), "start")).toBe("You can only message accepted friends.");
  });

  test("network and unknown errors suggest trying again", () => {
    expect(chatErrorMessage(info("network"), "load-chats")).toContain("Check your connection");
    expect(chatErrorMessage(info("server", 500), "load-friends")).toBe("Unable to load your friends. Please try again.");
  });

  test("never shows the raw backend detail", () => {
    for (const kind of ["forbidden", "not_found", "conflict", "validation", "server"] as const) {
      expect(chatErrorMessage(info(kind), "send")).not.toContain("backend text");
    }
  });
});
