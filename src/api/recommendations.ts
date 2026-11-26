import api from "@/api/client";
import { parseRecommendationList } from "@/lib/recommendations/parse";
import type { Recommendation, RecommendationRequest } from "@/types/recommendation";

/**
 * POST /api/recommendations
 *
 * Sends the request exactly as built by the questionnaire. Returns the
 * recommendations in the backend's ranking order; an empty array is a valid result.
 */
export async function getRecommendations(
  request: RecommendationRequest,
  signal?: AbortSignal,
): Promise<Recommendation[]> {
  const response = await api.post<unknown>("/recommendations", request, { signal });

  const recommendations = parseRecommendationList(response.data);
  if (recommendations === null) {
    throw new Error("Unexpected response format from POST /api/recommendations");
  }

  return recommendations;
}
