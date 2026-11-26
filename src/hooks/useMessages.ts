"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createPrivateConversation,
  getConversations,
  getMessages,
  sendMessage,
} from "@/api/conversations";
import { getFriends } from "@/api/friends";
import { useAuth } from "@/auth/useAuth";
import { ChatStore, type ChatApi } from "@/lib/messages/chat-store";

/** How often the selected chat checks for new messages while the tab is visible. */
export const POLL_INTERVAL_MS = 5000;

const chatApi: ChatApi = {
  getConversations,
  getFriends,
  createPrivateConversation,
  getMessages,
  sendMessage,
};

/**
 * The Messages page's state for the signed-in user. Request handling lives in ChatStore
 * (lib/messages/chat-store.ts): data is scoped to user + token, stale responses are
 * ignored, and drafts and sends are kept per conversation.
 */
export function useMessages() {
  const { session } = useAuth();
  const myId = session?.user.id ?? null;
  const token = session?.access_token ?? null;
  const scope = myId !== null && token !== null ? `${myId}|${token}` : null;

  const [store] = useState(() => new ChatStore(chatApi));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  useEffect(() => {
    if (scope === null) return;
    store.open(scope);
    return () => store.close();
  }, [store, scope]);

  // Poll only while the tab is visible, and check right away when it becomes visible again.
  useEffect(() => {
    const pollIfVisible = () => {
      if (document.visibilityState === "visible") store.poll();
    };
    const timer = window.setInterval(pollIfVisible, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", pollIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pollIfVisible);
    };
  }, [store]);

  return { state, store, myId };
}
