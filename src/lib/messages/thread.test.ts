/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import {
  compareMessages,
  incomingSince,
  isNearBottom,
  mergeMessages,
  shouldScrollToBottom,
  threadView,
} from "@/lib/messages/thread";
import type { Message } from "@/types/conversation";

function message(id: number, userId: number, createdAt: string, conversationId = 10): Message {
  return { id, conversation_id: conversationId, user_id: userId, content: `m${id}`, created_at: createdAt };
}

const m1 = message(1, 2, "2026-11-20T10:00:00Z");
const m2 = message(2, 1, "2026-11-20T10:01:00Z");
const m3 = message(3, 2, "2026-11-20T10:02:00Z");

describe("message order", () => {
  test("sorts oldest first and breaks timestamp ties by id", () => {
    const tieA = message(8, 1, "2026-11-20T10:05:00Z");
    const tieB = message(9, 2, "2026-11-20T10:05:00Z");
    expect([tieB, m3, tieA, m1].sort(compareMessages)).toEqual([m1, m3, tieA, tieB]);
  });

  test("compares instants, not strings (time zone offsets)", () => {
    const earlier = message(5, 1, "2026-11-20T12:00:00+02:00"); // 10:00Z
    const later = message(4, 1, "2026-11-20T10:30:00Z");
    expect([later, earlier].sort(compareMessages)).toEqual([earlier, later]);
  });
});

describe("mergeMessages", () => {
  test("turns the backend's newest-first list into oldest first", () => {
    expect(mergeMessages([], [m3, m2, m1], 10)).toEqual([m1, m2, m3]);
  });

  test("returns the same array when nothing is new", () => {
    const current = [m1, m2];
    expect(mergeMessages(current, [m2, m1], 10)).toBe(current);
    expect(mergeMessages(current, [], 10)).toBe(current);
  });

  test("keeps messages missing from an older response", () => {
    expect(mergeMessages([m1, m2, m3], [m1], 10)).toEqual([m1, m2, m3]);
  });

  test("never duplicates a message", () => {
    expect(mergeMessages([m1], [m2, m2, m1], 10)).toEqual([m1, m2]);
  });

  test("drops messages of other conversations", () => {
    expect(mergeMessages([], [message(7, 2, "2026-11-20T10:00:00Z", 20), m1], 10)).toEqual([m1]);
  });
});

describe("shouldScrollToBottom", () => {
  const loaded = (lastMessageId: number | null, conversationId = 10) => ({
    conversationId,
    loaded: true,
    lastMessageId,
  });

  test("scrolls on a chat's first load", () => {
    expect(shouldScrollToBottom(null, loaded(3), false, false)).toBe(true);
    expect(shouldScrollToBottom({ conversationId: 10, loaded: false, lastMessageId: null }, loaded(3), false, false)).toBe(true);
    expect(shouldScrollToBottom(loaded(9, 20), loaded(3), false, false)).toBe(true);
  });

  test("doesn't scroll while loading or for an empty chat", () => {
    expect(shouldScrollToBottom(null, { conversationId: 10, loaded: false, lastMessageId: null }, false, true)).toBe(false);
    expect(shouldScrollToBottom(null, loaded(null), false, true)).toBe(false);
  });

  test("doesn't scroll when a poll brought nothing new, even at the bottom", () => {
    expect(shouldScrollToBottom(loaded(3), loaded(3), false, true)).toBe(false);
  });

  test("doesn't pull a reader of older messages down for someone else's message", () => {
    expect(shouldScrollToBottom(loaded(3), loaded(4), false, false)).toBe(false);
  });

  test("follows new messages when already near the bottom, and always after an own send", () => {
    expect(shouldScrollToBottom(loaded(3), loaded(4), false, true)).toBe(true);
    expect(shouldScrollToBottom(loaded(3), loaded(4), true, false)).toBe(true);
  });

  test("isNearBottom allows a small gap", () => {
    expect(isNearBottom(900, 1500, 600)).toBe(true);
    expect(isNearBottom(850, 1500, 600)).toBe(true);
    expect(isNearBottom(500, 1500, 600)).toBe(false);
  });
});

describe("incomingSince", () => {
  const myId = 1;

  test("announces nothing on first load", () => {
    expect(incomingSince(null, threadView(10, true, [m1, m2, m3]), [m1, m2, m3], myId)).toEqual([]);
  });

  test("returns only new messages from other people", () => {
    const m4 = message(4, 1, "2026-11-20T10:03:00Z");
    const m5 = message(5, 2, "2026-11-20T10:04:00Z");
    const list = [m1, m2, m3, m4, m5];
    const previous = threadView(10, true, [m1, m2]);
    expect(incomingSince(previous, threadView(10, true, list), list, myId)).toEqual([m3, m5]);
  });

  test("announces nothing when nothing changed", () => {
    const view = threadView(10, true, [m1, m2]);
    expect(incomingSince(view, view, [m1, m2], myId)).toEqual([]);
  });

  test("counts a first message arriving in an empty chat", () => {
    expect(incomingSince(threadView(10, true, []), threadView(10, true, [m1]), [m1], myId)).toEqual([m1]);
  });
});
