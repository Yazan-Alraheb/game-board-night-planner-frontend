/**
 * Request types for POST /api/recommendations.
 *
 * Checked against the live backend schema `RecommendationRequest`
 * (additionalProperties: false, so only these fields may be sent).
 */

export type RecommendationMode = "personal" | "game_night";

/** The player's experience. Not the same as a game's Easy/Medium/Hard difficulty. */
export type ExperienceLevel = "Beginner" | "Intermediate" | "Experienced";

interface RecommendationRequestBase {
  /** Positive integer, in minutes. Always required. */
  max_playtime: number;
  /** Omit when nothing is selected. Never send null. */
  categories?: string[];
  /** Omit for "no preference". Never send null. */
  experience_level?: ExperienceLevel;
}

/** Personal mode: the current user's owned collection. player_count is required, game_night_id is forbidden. */
export interface PersonalRecommendationRequest extends RecommendationRequestBase {
  mode: "personal";
  player_count: number;
}

/** Game-night mode: the backend combines the host's and accepted attendees' owned collections. */
export interface GameNightRecommendationRequest extends RecommendationRequestBase {
  mode: "game_night";
  game_night_id: number;
  /** Optional override; the backend defaults it to the number of eligible participants. */
  player_count?: number;
}

export type RecommendationRequest =
  | PersonalRecommendationRequest
  | GameNightRecommendationRequest;
