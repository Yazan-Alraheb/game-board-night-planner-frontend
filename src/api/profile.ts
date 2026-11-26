import api from "@/api/client";
import type { AuthUser } from "@/api/auth";
import type { PublicUser } from "@/types/friend";

export interface ProfileUpdateRequest {
  name: string;
  bio: string | null;
  avatar_url: string | null;
}

export async function getProfile(
  userId: number,
  signal?: AbortSignal
): Promise<PublicUser> {
  const response = await api.get<{ user: PublicUser }>(
    `/users/${userId}`,
    { signal }
  );

  return response.data.user;
}

export async function updateProfile(
  userId: number,
  profile: ProfileUpdateRequest,
  signal?: AbortSignal
): Promise<AuthUser> {
  const response = await api.put<{ user: AuthUser }>(
    `/users/${userId}`,
    profile,
    { signal }
  );

  return response.data.user;
}
