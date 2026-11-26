/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ChatPane from "@/components/messages/ChatPane";
import type { Thread } from "@/lib/messages/chat-store";
import type { Conversation, Message } from "@/types/conversation";
import type { PublicUser } from "@/types/friend";

/**
 * Regression: typing in the composer made the page jump.
 *
 * Cause: the bubbles' screen-reader labels use `sr-only` (position:absolute). Without a
 * positioned ancestor their containing block was <body>, so they escaped the message
 * list's overflow clip and stretched the page by the list's whole height. The page could
 * then scroll far past the composer, and each keystroke scrolled the input back into view.
 *
 * Bun has no layout engine, so this checks the structural invariant instead: every
 * sr-only element has a positioned ancestor, and inside the scrolling message list that
 * ancestor is the list itself or something within it.
 */

const user = (id: number, name: string): PublicUser => ({
  id,
  name,
  username: name.toLowerCase(),
  bio: null,
  avatar_url: null,
});

const me = user(1, "Me");
const alice = user(2, "Alice");
const bob = user(3, "Bob");

const message = (id: number, userId: number): Message => ({
  id,
  conversation_id: 10,
  user_id: userId,
  content: `message ${id}`,
  created_at: "2026-11-26T10:00:00Z",
});

function render(conversation: Conversation, messages: Message[]) {
  const thread: Thread = {
    conversationId: conversation.id,
    status: "success",
    messages,
    error: null,
    refreshFailures: 0,
  };
  const noop = () => {};
  return renderToStaticMarkup(
    <ChatPane
      conversation={conversation}
      thread={thread}
      myId={me.id}
      draft="typing"
      sending={false}
      sendFailure={null}
      onDraftChange={noop}
      onSend={noop}
      onRetrySend={noop}
      onDismissSendFailure={noop}
      onRetryLoad={noop}
      onRefreshNow={noop}
    />,
  );
}

const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source", "wbr", "area", "col", "embed"]);
const POSITIONED = /(^|\s)(relative|absolute|fixed|sticky)(\s|$)/;

interface SrOnlyPlacement {
  text: string;
  hasPositionedAncestor: boolean;
  insideList: boolean;
  /** For elements inside the list: the nearest positioned ancestor is the list or deeper. */
  containedByList: boolean;
}

/** Walks the static markup and reports, for each sr-only element, its positioned ancestors. */
function srOnlyPlacements(html: string): SrOnlyPlacement[] {
  const stack: { tag: string; positioned: boolean; isList: boolean }[] = [];
  const found: SrOnlyPlacement[] = [];
  const tagPattern = /<(\/?)([a-z0-9]+)([^>]*)>([^<]*)/gi;

  for (const [, closing, rawTag, attributes, text] of html.matchAll(tagPattern)) {
    const tag = rawTag.toLowerCase();
    if (closing) {
      stack.pop();
      continue;
    }
    const className = /class="([^"]*)"/.exec(attributes)?.[1] ?? "";

    if (/(^|\s)sr-only(\s|$)/.test(className)) {
      const listIndex = stack.findIndex((element) => element.isList);
      const positionedIndex = stack.findLastIndex((element) => element.positioned);
      found.push({
        text: text.trim(),
        hasPositionedAncestor: positionedIndex !== -1,
        insideList: listIndex !== -1,
        containedByList: listIndex !== -1 && positionedIndex >= listIndex,
      });
    }

    if (VOID.has(tag) || attributes.trimEnd().endsWith("/")) continue;
    stack.push({
      tag,
      positioned: POSITIONED.test(className),
      isList: /\sdata-message-list(=|\s|$)/.test(attributes),
    });
  }
  return found;
}

describe("ChatPane screen-reader text can't stretch the page", () => {
  test("private chat: every sr-only label is contained", () => {
    const html = render(
      { id: 10, type: "private", game_night_id: null, participants: [me, alice], created_at: "" },
      [message(1, 2), message(2, 1), message(3, 2)],
    );
    const placements = srOnlyPlacements(html);

    // The composer label, the live region, and a "You:"/"Alice:" label per bubble.
    expect(placements.length).toBe(5);
    expect(placements.filter((p) => p.insideList).map((p) => p.text)).toEqual(["Alice:", "You:", "Alice:"]);
    for (const placement of placements) {
      expect(placement.hasPositionedAncestor).toBe(true);
      if (placement.insideList) expect(placement.containedByList).toBe(true);
    }
  });

  test("group chat: own-message labels are contained too", () => {
    const html = render(
      { id: 10, type: "group", game_night_id: 5, participants: [me, alice, bob], created_at: "" },
      [message(1, 2), message(2, 1), message(3, 3), message(4, 1)],
    );
    const inList = srOnlyPlacements(html).filter((p) => p.insideList);

    expect(inList.map((p) => p.text)).toEqual(["You:", "You:"]);
    expect(inList.every((p) => p.containedByList)).toBe(true);
  });

  test("the scrolling list is the positioned container", () => {
    const html = render(
      { id: 10, type: "private", game_night_id: null, participants: [me, alice], created_at: "" },
      [message(1, 2)],
    );
    const list = /<div[^>]*data-message-list[^>]*>/.exec(html)?.[0] ?? "";
    expect(list).toMatch(/class="[^"]*\boverflow-y-auto\b/);
    expect(list).toMatch(/class="(?:[^"]*\s)?relative[\s"]/);
  });
});
