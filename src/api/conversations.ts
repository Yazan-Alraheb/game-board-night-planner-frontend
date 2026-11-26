import api from "@/api/client";
import type {
  Conversation,
  ConversationEnvelope,
  ConversationListResponse,
  Message,
  MessageEnvelope,
  MessageListResponse,
} from "@/types/conversation";

/** The backend's limit for one message (MessageCreate.content max_length). */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * GET /api/conversations: chats the current user may open, newest first.
 * The backend leaves out private chats without an accepted friendship and
 * game-night chats the user is no longer an accepted attendee of.
 */
export async function getConversations(signal?: AbortSignal): Promise<Conversation[]> {
  const response = await api.get<ConversationListResponse>("/conversations", { signal });

  if (!response.data || !Array.isArray(response.data.conversations)) {
    throw new Error("Unexpected response format from GET /api/conversations");
  }

  return response.data.conversations;
}

/**
 * POST /api/conversations: starts a private chat with an accepted friend.
 * 409 when a private chat with that friend already exists.
 */
export async function createPrivateConversation(friendId: number): Promise<Conversation> {
  const response = await api.post<ConversationEnvelope>("/conversations", {
    participant_ids: [friendId],
    type: "private",
  });

  return response.data.conversation;
}

/**
 * GET /api/conversations/{id}/messages: the latest 50 messages, NEWEST FIRST.
 * 403 when the user is no longer allowed in the chat, 404 when it doesn't exist.
 */
export async function getMessages(conversationId: number, signal?: AbortSignal): Promise<Message[]> {
  const response = await api.get<MessageListResponse>(`/conversations/${conversationId}/messages`, {
    signal,
  });

  if (!response.data || !Array.isArray(response.data.messages)) {
    throw new Error("Unexpected response format from GET /api/conversations/{id}/messages");
  }

  return response.data.messages;
}

/** POST /api/conversations/{id}/messages: 1–2000 characters, not only whitespace. */
export async function sendMessage(conversationId: number, content: string): Promise<Message> {
  const response = await api.post<MessageEnvelope>(`/conversations/${conversationId}/messages`, {
    content,
  });

  return response.data.message;
}
