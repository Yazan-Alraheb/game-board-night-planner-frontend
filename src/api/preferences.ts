import axios from "axios";
import api from "@/api/client";

import type {
  UserPreferences,
  PreferenceResponse,
  PreferenceUpdateRequest,
} from "@/types/preference";

// Retrieve the authenticated user's preferences
export async function getPreferences(
  userId: number,
  signal?: AbortSignal
): Promise<UserPreferences | null> {
  try {
    const response = await api.get<PreferenceResponse>(
      `/users/${userId}/preferences`,
      { signal }
    );

    return response.data.preferences;
  } catch (error: unknown) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 404 &&
      error.response.data?.detail === "Preferences not found"
    ) {
      return null;
    }

    throw error;
  }
}

// Create or update the user's preferences
export async function updatePreferences(
  userId: number,
  preferences: PreferenceUpdateRequest,
  signal?: AbortSignal
): Promise<UserPreferences> {
  const response = await api.put<PreferenceResponse>(
    `/users/${userId}/preferences`,
    preferences,
    { signal }
  );

  return response.data.preferences;
}
