import api from "@/api/client";
import type {
  GameNightListResponse,
  GameNightMember,
  GameNightMembersResponse,
  GameNightResponse,
} from "@/types/game-night";

/** GET /api/game-nights: game nights the current user hosts or is a member of. */
export async function getGameNights(signal?: AbortSignal): Promise<GameNightResponse[]> {
  const response = await api.get<GameNightListResponse>("/game-nights", { signal });

  if (!response.data || !Array.isArray(response.data.game_nights)) {
    throw new Error("Unexpected response format from GET /api/game-nights");
  }

  return response.data.game_nights;
}

/**
 * GET /api/game-nights/{id}/members: everyone on the night with their RSVP status.
 * The host is included as an "accepted" member. 404 if the user can't see the night.
 */
export async function getGameNightMembers(
  gameNightId: number,
  signal?: AbortSignal,
): Promise<GameNightMember[]> {
  const response = await api.get<GameNightMembersResponse>(`/game-nights/${gameNightId}/members`, {
    signal,
  });

  if (!response.data || !Array.isArray(response.data.members)) {
    throw new Error("Unexpected response format from GET /api/game-nights/{id}/members");
  }

  return response.data.members;
}
