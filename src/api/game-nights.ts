import api from "@/api/client";
import type {
  GameNightAvailableGamesResponse,
  GameNightDetailResponse,
  GameNightGameResponse,
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

/** GET /api/game-nights/{id}: one game night's details. */
export async function getGameNight(id: number, signal?: AbortSignal): Promise<GameNightResponse> {
  const response = await api.get<GameNightDetailResponse>(`/game-nights/${id}`, { signal });

  if (!response.data?.game_night || typeof response.data.game_night.name !== "string") {
    throw new Error("Unexpected response format from GET /api/game-nights/{id}");
  }

  return response.data.game_night;
}

/**
 * GET /api/game-nights/{id}/games: ids of the games already selected for the event.
 * (The endpoint also lists available games and owners; only `selected` is needed here.)
 */
export async function getSelectedGameIds(id: number, signal?: AbortSignal): Promise<Set<number>> {
  const response = await api.get<GameNightAvailableGamesResponse>(`/game-nights/${id}/games`, {
    signal,
  });

  if (!response.data || !Array.isArray(response.data.games)) {
    throw new Error("Unexpected response format from GET /api/game-nights/{id}/games");
  }

  return new Set(
    response.data.games
      .filter((entry) => entry?.selected === true && typeof entry.game?.id === "number")
      .map((entry) => entry.game.id),
  );
}

/** POST /api/game-nights/{id}/games: select a game for the event. 409 means it is already selected. */
export async function addGameToGameNight(
  gameNightId: number,
  gameId: number,
): Promise<GameNightGameResponse> {
  const response = await api.post<GameNightGameResponse>(`/game-nights/${gameNightId}/games`, {
    game_id: gameId,
  });
  return response.data;
}
