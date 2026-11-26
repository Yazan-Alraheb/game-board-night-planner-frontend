import type { PublicUser } from "@/types/friend";

/** Matches the backend's ConversationResponse (GET/POST /api/conversations). */
export interface Conversation {
  id: number;
  type: "private" | "group";
  /** Set for a game night's group chat. */
  game_night_id: number | null;
  /** Everyone in the chat, the current user included, sorted by user id. */
  participants: PublicUser[];
  created_at: string;
}

/** Matches the backend's MessageResponse. Messages can't be edited or deleted. */
export interface Message {
  id: number;
  conversation_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
}

export interface ConversationEnvelope {
  conversation: Conversation;
}

export interface MessageListResponse {
  messages: Message[];
}

export interface MessageEnvelope {
  message: Message;
}
