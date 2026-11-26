export interface PreferenceUpdateRequest {
  favorite_categories: string[];
  disliked_categories: string[];
  preferred_difficulty: "Easy" | "Medium" | "Hard" | null;
  preferred_playtime: number | null;
}

export interface UserPreferences extends PreferenceUpdateRequest {
  id: number;
  user_id: number;
}

export interface PreferenceResponse {
  preferences: UserPreferences;
}