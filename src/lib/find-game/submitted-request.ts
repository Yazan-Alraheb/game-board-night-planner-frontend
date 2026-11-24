/**
 * The request the user submitted with "Get Recommendations".
 *
 * Kept apart from the editable questionnaire draft (storage.ts): the draft can change
 * after submitting, but this snapshot always shows what the results are for.
 * It is replaced on every new submission.
 *
 * Stored in sessionStorage (this tab only), scoped to the user id. It holds only the
 * RecommendationRequest fields: no tokens, profile data or attendee preferences.
 *
 * Usage on the recommendations page:
 *   const result = loadSubmittedRequest(session.user.id);
 *   if (result.status !== "ok") → send the user back to the questionnaire
 *   else POST result.snapshot.request
 */
import { EXPERIENCE_LEVELS } from "@/lib/find-game/questionnaire";
import type {
  ExperienceLevel,
  RecommendationRequest,
} from "@/types/recommendation";

const SUBMITTED_REQUEST_KEY = "gamenight_submitted_recommendation_request";
const SNAPSHOT_VERSION = 1;

/** Backend limits from the RecommendationRequest schema. */
const MAX_INT = 2147483647;
const MAX_CATEGORIES = 50;
const MAX_CATEGORY_LENGTH = 100;

export interface SubmittedRequestSnapshot {
  readonly userId: number;
  /** ISO 8601 timestamp of the submission. */
  readonly submittedAt: string;
  readonly request: Readonly<RecommendationRequest>;
}

export type LoadSubmittedRequestResult =
  | { status: "ok"; snapshot: SubmittedRequestSnapshot }
  /** Nothing submitted in this tab (e.g. the results URL was opened directly). */
  | { status: "missing" }
  /** Stored by another user or an older app version. It is removed. */
  | { status: "stale" }
  /** Corrupt or tampered data. It is removed. */
  | { status: "invalid" };

/** Saves a validated request as the current submission, replacing any earlier one. Returns false if storage failed. */
export function saveSubmittedRequest(
  userId: number,
  request: RecommendationRequest,
  now: Date = new Date(),
): boolean {
  // Re-check, then copy only the known fields, so nothing extra can be stored.
  const clean = parseRecommendationRequest(request);
  if (!clean) return false;

  try {
    window.sessionStorage.setItem(
      SUBMITTED_REQUEST_KEY,
      JSON.stringify({
        version: SNAPSHOT_VERSION,
        userId,
        submittedAt: now.toISOString(),
        request: clean,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadSubmittedRequest(userId: number): LoadSubmittedRequestResult {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(SUBMITTED_REQUEST_KEY);
  } catch {
    return { status: "missing" };
  }
  if (raw === null) return { status: "missing" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearSubmittedRequest();
    return { status: "invalid" };
  }

  if (!isRecord(parsed)) {
    clearSubmittedRequest();
    return { status: "invalid" };
  }

  if (parsed.version !== SNAPSHOT_VERSION || parsed.userId !== userId) {
    clearSubmittedRequest();
    return { status: "stale" };
  }

  const request = parseRecommendationRequest(parsed.request);
  const submittedAt = parsed.submittedAt;
  if (!request || typeof submittedAt !== "string" || Number.isNaN(Date.parse(submittedAt))) {
    clearSubmittedRequest();
    return { status: "invalid" };
  }

  return {
    status: "ok",
    snapshot: Object.freeze({ userId, submittedAt, request: freezeRequest(request) }),
  };
}

export function clearSubmittedRequest(): void {
  try {
    window.sessionStorage.removeItem(SUBMITTED_REQUEST_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** True when two requests ask for the same thing (e.g. to check whether the draft was edited after submitting). */
export function isSameRequest(a: RecommendationRequest, b: RecommendationRequest): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

// ---------------------------------------------------------------------------
// Validation (stored data may be stale or edited, so check it field by field)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_INT;
}

const ALLOWED_KEYS = new Set([
  "mode",
  "game_night_id",
  "player_count",
  "max_playtime",
  "categories",
  "experience_level",
]);

/**
 * Validates a value against the backend's RecommendationRequest rules and returns a
 * clean copy with only the allowed fields, or null if it is invalid.
 */
export function parseRecommendationRequest(value: unknown): RecommendationRequest | null {
  if (!isRecord(value)) return null;
  if (Object.keys(value).some((key) => !ALLOWED_KEYS.has(key))) return null;

  const { mode, game_night_id, player_count, max_playtime, categories, experience_level } = value;

  if (!isPositiveInt(max_playtime)) return null;

  // Optional fields must be absent, never null.
  const optional: { categories?: string[]; experience_level?: ExperienceLevel } = {};
  if (categories !== undefined) {
    if (
      !Array.isArray(categories) ||
      categories.length === 0 ||
      categories.length > MAX_CATEGORIES ||
      !categories.every(
        (category) =>
          typeof category === "string" &&
          category.trim().length > 0 &&
          category.length <= MAX_CATEGORY_LENGTH,
      )
    ) {
      return null;
    }
    optional.categories = [...(categories as string[])];
  }
  if (experience_level !== undefined) {
    if (!EXPERIENCE_LEVELS.includes(experience_level as ExperienceLevel)) return null;
    optional.experience_level = experience_level as ExperienceLevel;
  }

  if (mode === "personal") {
    if (game_night_id !== undefined || !isPositiveInt(player_count)) return null;
    return { mode, player_count, max_playtime, ...optional };
  }

  if (mode === "game_night") {
    if (!isPositiveInt(game_night_id)) return null;
    if (player_count !== undefined && !isPositiveInt(player_count)) return null;
    return {
      mode,
      game_night_id,
      ...(player_count !== undefined ? { player_count } : {}),
      max_playtime,
      ...optional,
    };
  }

  return null;
}

function freezeRequest(request: RecommendationRequest): Readonly<RecommendationRequest> {
  if (request.categories) Object.freeze(request.categories);
  return Object.freeze(request);
}

/** JSON with sorted keys, so field order doesn't affect comparisons. */
function canonicalJson(request: RecommendationRequest): string {
  const record = request as unknown as Record<string, unknown>;
  return JSON.stringify(
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]]),
  );
}
