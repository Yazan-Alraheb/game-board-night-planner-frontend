export interface PublicUser {
  id: number;
  name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

export interface FriendRequest {
  id: number;
  requester_id: number;
  receiver_id: number;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface FriendsResponse {
  friends: PublicUser[];
}

export interface UserSearchResponse {
  users: PublicUser[];
}

export interface FriendRequestsResponse {
  requests: FriendRequest[];
}

export interface FriendRequestResponse {
  friend_request: FriendRequest;
}
