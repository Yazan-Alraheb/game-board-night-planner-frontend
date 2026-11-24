/**
 * Saves the Find a Game questionnaire draft in sessionStorage.
 *
 * - Survives Back/Next, a page refresh and the trip to the recommendations page.
 * - Lasts only for this browser tab, like the auth session (src/auth/session.ts).
 * - Scoped to the user id, so a different account in the same tab starts fresh.
 * - Holds only the user's own answers: no tokens and no saved preferences.
 */
import {
  EXPERIENCE_LEVELS,
  INITIAL_STATE,
  isStepIndex,
  type QuestionnaireAnswers,
  type QuestionnaireState,
} from "@/lib/find-game/questionnaire";
import type { ExperienceLevel, RecommendationMode } from "@/types/recommendation";

const DRAFT_KEY = "gamenight_find_game_draft";
const DRAFT_VERSION = 1;

interface StoredDraft {
  version: typeof DRAFT_VERSION;
  userId: number;
  state: QuestionnaireState;
}

export function loadDraft(userId: number): QuestionnaireState {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return INITIAL_STATE;

    const parsed: unknown = JSON.parse(raw);
    const state = parseDraft(parsed, userId);
    if (!state) {
      clearDraft();
      return INITIAL_STATE;
    }
    return state;
  } catch {
    // Storage blocked or corrupt JSON: start fresh rather than crash.
    return INITIAL_STATE;
  }
}

export function saveDraft(userId: number, state: QuestionnaireState): void {
  const draft: StoredDraft = { version: DRAFT_VERSION, userId, state };
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the questionnaire still works, just without persistence.
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore: nothing to clear.
  }
}

// ---------------------------------------------------------------------------
// Validation of stored data (it can be edited or stale, so never trust it blindly)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMode(value: unknown): value is RecommendationMode {
  return value === "personal" || value === "game_night";
}

function isExperience(value: unknown): value is ExperienceLevel {
  return EXPERIENCE_LEVELS.includes(value as ExperienceLevel);
}

function parseAnswers(value: unknown): QuestionnaireAnswers | null {
  if (!isRecord(value)) return null;
  const { mode, playerCount, gameNightId, maxPlaytime, categories, experienceLevel } = value;

  if (mode !== null && !isMode(mode)) return null;
  if (typeof playerCount !== "string" || typeof maxPlaytime !== "string") return null;
  if (gameNightId !== null && !(Number.isInteger(gameNightId) && (gameNightId as number) > 0)) return null;
  if (!Array.isArray(categories) || !categories.every((item) => typeof item === "string")) return null;
  if (experienceLevel !== null && !isExperience(experienceLevel)) return null;

  return {
    mode,
    playerCount,
    gameNightId: gameNightId as number | null,
    maxPlaytime,
    categories: categories as string[],
    experienceLevel,
  };
}

function parseDraft(value: unknown, userId: number): QuestionnaireState | null {
  if (!isRecord(value) || value.version !== DRAFT_VERSION || value.userId !== userId) return null;
  if (!isRecord(value.state) || !isStepIndex(value.state.step)) return null;

  const answers = parseAnswers(value.state.answers);
  return answers ? { step: value.state.step, answers } : null;
}
