import api from "@/api/client";

import type {
  PublicUser,
  FriendRequest,
  FriendsResponse,
  UserSearchResponse,
  FriendRequestsResponse,
  FriendRequestResponse,
} from "@/types/friend";

// Get all accepted friends
export async function getFriends(signal?: AbortSignal): Promise<PublicUser[]> {
  const response = await api.get<FriendsResponse>("/friends", { signal });

  if (!response.data || !Array.isArray(response.data.friends)) {
    throw new Error("Unexpected response format from GET /api/friends");
  }

  return response.data.friends;
}

// Search by name or username
// Prefix with @ for an exact username match
export async function searchUsers(
  search: string
): Promise<PublicUser[]> {
  const response = await api.get<UserSearchResponse>("/users", {
    params: { search },
  });

  return response.data.users;
}

// Get a user's public profile
export async function getUser(
  userId: number
): Promise<PublicUser> {
  const response = await api.get<{ user: PublicUser }>(
    `/users/${userId}`
  );

  return response.data.user;
}

// Send a friend request
export async function sendFriendRequest(
  userId: number
): Promise<FriendRequest> {
  const response = await api.post<FriendRequestResponse>(
    "/friend-requests",
    { user_id: userId }
  );

  return response.data.friend_request;
}

// Get incoming or outgoing friend requests
export async function getFriendRequests(
  type: "incoming" | "outgoing"
): Promise<FriendRequest[]> {
  const response = await api.get<FriendRequestsResponse>(
    "/friend-requests",
    { params: { type } }
  );

  return response.data.requests;
}

// Accept or decline a friend request
export async function updateFriendRequest(
  requestId: number,
  status: "accepted" | "declined"
): Promise<FriendRequest> {
  const response = await api.put<FriendRequestResponse>(
    `/friend-requests/${requestId}`,
    { status }
  );

  return response.data.friend_request;
}

// Cancel an outgoing friend request
export async function cancelFriendRequest(
  requestId: number
): Promise<void> {
  await api.delete(`/friend-requests/${requestId}`);
}

// Remove an existing friend
export async function removeFriend(
  userId: number
): Promise<void> {
  await api.delete(`/friends/${userId}`);
}
