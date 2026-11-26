import type { Game } from "@/types/game";

/** Backend enum: a collection entry is either owned or on the wishlist. */
export type CollectionStatus = "owned" | "wishlist";

/** Backend schema: CollectionGameResponse */
export interface CollectionGame {
  game: Game;
  status: CollectionStatus;
}

/** Backend schema: CollectionListResponse (GET /api/users/{id}/collection) */
export interface CollectionListResponse {
  games: CollectionGame[];
}
