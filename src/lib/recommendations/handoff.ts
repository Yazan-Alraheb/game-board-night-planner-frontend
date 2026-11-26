/**
 * Moving between the results page and the Find a Game questionnaire.
 */
import {
  LAST_STEP,
  buildRecommendationRequest,
  type QuestionnaireAnswers,
} from "@/lib/find-game/questionnaire";
import { clearDraft, loadDraft, saveDraft } from "@/lib/find-game/storage";
import { clearSubmittedRequest, isSameRequest } from "@/lib/find-game/submitted-request";
import { clearCachedResults } from "@/lib/recommendations/results-cache";
import type { RecommendationRequest } from "@/types/recommendation";

/** Questionnaire answers that reproduce a submitted request. */
export function answersFromRequest(request: RecommendationRequest): QuestionnaireAnswers {
  return {
    mode: request.mode,
    playerCount: request.mode === "personal" ? String(request.player_count) : "",
    gameNightId: request.mode === "game_night" ? request.game_night_id : null,
    maxPlaytime: String(request.max_playtime),
    categories: [...(request.categories ?? [])],
    experienceLevel: request.experience_level ?? null,
  };
}

/**
 * "Edit answers": keep the user's current draft if there is one (it may hold newer,
 * unsubmitted edits). Only when the draft is gone, rebuild it from the submitted
 * request so the questionnaire opens on the review step with those answers.
 */
export function prepareDraftForEditing(userId: number, request: RecommendationRequest): void {
  const draft = loadDraft(userId);
  if (draft.answers.mode === null) {
    saveDraft(userId, { step: LAST_STEP, answers: answersFromRequest(request) });
  }
}

/** "Start over": clear the draft, the submitted request and the cached results. */
export function startOver(): void {
  clearDraft();
  clearSubmittedRequest();
  clearCachedResults();
}

/**
 * True when the user edited the questionnaire after submitting, so the results
 * no longer match their current answers. An incomplete draft also counts as changed.
 */
export function draftDiffersFromRequest(userId: number, request: RecommendationRequest): boolean {
  const draft = loadDraft(userId);
  if (draft.answers.mode === null) return false; // No draft: nothing to compare.
  const built = buildRecommendationRequest(draft.answers);
  return !built.ok || !isSameRequest(built.request, request);
}
