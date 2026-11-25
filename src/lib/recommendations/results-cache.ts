/**
 * Session cache for recommendation RESULTS. The submitted REQUEST is stored
 * separately in lib/find-game/submitted-request.ts.
 *
 * Purpose: refreshing the results page shows the same results without a second POST.
 *
 * Results are only reused for the exact submission they were fetched for, which
 * means the same user, submission time and request. Every "Get Recommendations"
 * creates a new submission time, so a new submission always fetches fresh results
 * and old results can never show up for changed answers.
 *
 * Holds only what the backend returned for this user: games, scores, reasons and
 * public owner fields (id, name, bio, avatar). No tokens.
 */
import { parseRecommendationList } from "@/lib/recommendations/parse";
import {
  isSameRequest,
  parseRecommendationRequest,
  type SubmittedRequestSnapshot,
} from "@/lib/find-game/submitted-request";
import type { Recommendation } from "@/types/recommendation";

const RESULTS_KEY = "gamenight_recommendation_results";
const CACHE_VERSION = 1;

export function saveCachedResults(
  snapshot: SubmittedRequestSnapshot,
  recommendations: Recommendation[],
): void {
  try {
    window.sessionStorage.setItem(
      RESULTS_KEY,
      JSON.stringify({
        version: CACHE_VERSION,
        userId: snapshot.userId,
        submittedAt: snapshot.submittedAt,
        request: snapshot.request,
        recommendations,
      }),
    );
  } catch {
    // Storage full or blocked: results still show, a refresh just fetches again.
  }
}

/** Cached results for exactly this submission, or null (missing, for another submission, or invalid). */
export function loadCachedResults(snapshot: SubmittedRequestSnapshot): Recommendation[] | null {
  let parsed: unknown;
  try {
    const raw = window.sessionStorage.getItem(RESULTS_KEY);
    if (raw === null) return null;
    parsed = JSON.parse(raw);
  } catch {
    clearCachedResults();
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    clearCachedResults();
    return null;
  }

  const cached = parsed as Record<string, unknown>;
  const request = parseRecommendationRequest(cached.request);

  const matches =
    cached.version === CACHE_VERSION &&
    cached.userId === snapshot.userId &&
    cached.submittedAt === snapshot.submittedAt &&
    request !== null &&
    isSameRequest(request, snapshot.request);

  if (!matches) {
    // Results for an older submission (or another user) are outdated: remove them.
    clearCachedResults();
    return null;
  }

  const recommendations = parseRecommendationList({ recommendations: cached.recommendations });
  if (recommendations === null) clearCachedResults();
  return recommendations;
}

export function clearCachedResults(): void {
  try {
    window.sessionStorage.removeItem(RESULTS_KEY);
  } catch {
    // Nothing to clear.
  }
}
