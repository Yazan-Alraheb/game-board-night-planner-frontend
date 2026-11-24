import api from "@/api/client";
import type { GameNightListResponse, GameNightResponse } from "@/types/game-night";

/** GET /api/game-nights: game nights the current user hosts or is a member of. */
export async function getGameNights(signal?: AbortSignal): Promise<GameNightResponse[]> {
  const response = await api.get<GameNightListResponse>("/game-nights", { signal });

  if (!response.data || !Array.isArray(response.data.game_nights)) {
    throw new Error("Unexpected response format from GET /api/game-nights");
  }

  return response.data.game_nights;
}
