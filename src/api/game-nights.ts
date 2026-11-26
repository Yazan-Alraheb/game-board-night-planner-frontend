import api from "@/api/client";
import type {
  GameNightAvailableGame,
  GameNightAvailableGamesResponse,
  GameNightDetailResponse,
  GameNightGameResponse,
  GameNightInvite,
  GameNightListResponse,
  GameNightMember,
  GameNightMemberResponse,
  GameNightMembersResponse,
  GameNightResponse,
  GameNightUpdate,
  RsvpResponse,
  RsvpUpdate,
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
  const games = await getGameNightGames(id, signal);
  return new Set(games.filter((entry) => entry.selected).map((entry) => entry.game.id));
}

/**
 * GET /api/game-nights/{id}/games: every game owned by an accepted attendee, with its owners
 * and whether it is selected for the event. Selected games stop being listed once no accepted
 * attendee owns them (the backend also unselects them then). Malformed entries are dropped.
 */
export async function getGameNightGames(
  id: number,
  signal?: AbortSignal,
): Promise<GameNightAvailableGame[]> {
  const response = await api.get<GameNightAvailableGamesResponse>(`/game-nights/${id}/games`, {
    signal,
  });

  if (!response.data || !Array.isArray(response.data.games)) {
    throw new Error("Unexpected response format from GET /api/game-nights/{id}/games");
  }

  return response.data.games.filter(
    (entry) =>
      typeof entry?.game?.id === "number" &&
      typeof entry.game.name === "string" &&
      typeof entry.selected === "boolean" &&
      Array.isArray(entry.owners),
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

const RSVP_STATUSES: readonly string[] = ["pending", "accepted", "declined"];

/**
 * PUT /api/game-nights/{id}/rsvp: the current user answers their own invitation.
 * Returns the status the backend saved. Backend errors: 403 (not invited, or the host
 * tried to decline), 404 (night deleted or no longer visible), 422 (invalid body).
 */
export async function updateRsvp(
  gameNightId: number,
  status: RsvpUpdate["status"],
): Promise<RsvpResponse> {
  const body: RsvpUpdate = { status };
  const response = await api.put<RsvpResponse>(`/game-nights/${gameNightId}/rsvp`, body);

  if (!response.data || !RSVP_STATUSES.includes(response.data.status)) {
    throw new Error("Unexpected response format from PUT /api/game-nights/{id}/rsvp");
  }

  return response.data;
}

/**
 * PUT /api/game-nights/{id}: the host replaces name, start time, location and notes.
 * Members and selected games are not part of the body and stay unchanged.
 * Backend errors: 403 (not the host), 404 (deleted or no longer visible), 422 (invalid body).
 */
export async function updateGameNight(
  id: number,
  body: GameNightUpdate,
): Promise<GameNightResponse> {
  const response = await api.put<GameNightDetailResponse>(`/game-nights/${id}`, body);

  if (!response.data?.game_night || typeof response.data.game_night.name !== "string") {
    throw new Error("Unexpected response format from PUT /api/game-nights/{id}");
  }

  return response.data.game_night;
}

/**
 * DELETE /api/game-nights/{id}: permanently deletes the night for everyone, with its
 * invitations, selected games and chat. There is no cancelled status or undo. Host only (403).
 */
export async function deleteGameNight(id: number): Promise<void> {
  await api.delete(`/game-nights/${id}`);
}

/**
 * DELETE /api/game-nights/{id}/members/{user_id} with the current user's own id: leave the night.
 * The backend lets non-hosts remove only themselves and never lets the host leave (403).
 * This helper deliberately has no way to remove someone else.
 */
export async function leaveGameNight(gameNightId: number, currentUserId: number): Promise<void> {
  await api.delete(`/game-nights/${gameNightId}/members/${currentUserId}`);
}

/**
 * POST /api/game-nights/{id}/members: the host invites an accepted friend (status "pending").
 * Backend errors: 403 (not the host / not a friend), 404 (night or user), 409 (already a member).
 */
export async function inviteToGameNight(
  gameNightId: number,
  userId: number,
): Promise<GameNightMember> {
  const body: GameNightInvite = { user_id: userId };
  const response = await api.post<GameNightMemberResponse>(
    `/game-nights/${gameNightId}/members`,
    body,
  );

  if (!response.data?.member || typeof response.data.member.user?.id !== "number") {
    throw new Error("Unexpected response format from POST /api/game-nights/{id}/members");
  }

  return response.data.member;
}

/** DELETE /api/game-nights/{id}/games/{game_id}: the host unselects a game. 404 if not selected. */
export async function removeGameFromGameNight(gameNightId: number, gameId: number): Promise<void> {
  await api.delete(`/game-nights/${gameNightId}/games/${gameId}`);
}
