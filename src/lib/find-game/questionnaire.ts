/**
 * Find a Game questionnaire: state, validation and request building.
 *
 * Pure logic with no React or API calls, so the questionnaire UI and the
 * recommendations page can share it.
 */
import type {
  ExperienceLevel,
  RecommendationMode,
  RecommendationRequest,
} from "@/types/recommendation";

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export const STEPS = [
  { id: "group", label: "Group" },
  { id: "preferences", label: "Preferences" },
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
] as const;

export type StepIndex = 0 | 1 | 2 | 3;
export const LAST_STEP: StepIndex = 3;

export function isStepIndex(value: unknown): value is StepIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Upper bound for the player-count input. The backend accepts larger values, but more players isn't a realistic table. */
export const MAX_PLAYERS = 100;
/** Upper bound for the playtime input (24 hours). */
export const MAX_PLAYTIME_MINUTES = 1440;

export const PLAYER_COUNT_PRESETS = [
  { value: "1", label: "Just me", hint: "1 player" },
  { value: "2", label: "A couple", hint: "2 players" },
  { value: "3", label: "Three", hint: "3 players" },
  { value: "4", label: "Four", hint: "4 players" },
  { value: "5", label: "Five", hint: "5 players" },
  { value: "6", label: "Six", hint: "6 players" },
] as const;

/** Each option is a MAXIMUM playtime: the backend only supports max_playtime, not ranges. */
export const PLAYTIME_PRESETS = [
  { value: "30", label: "Up to 30 min", hint: "Quick games" },
  { value: "60", label: "Up to 1 hour", hint: "Most games fit here" },
  { value: "120", label: "Up to 2 hours", hint: "Longer sessions" },
  { value: "180", label: "Up to 3 hours", hint: "Epic evenings" },
] as const;

export const EXPERIENCE_OPTIONS: ReadonlyArray<{
  value: ExperienceLevel | null;
  label: string;
  hint: string;
}> = [
  { value: null, label: "No preference", hint: "Skip this question" },
  { value: "Beginner", label: "Beginner", hint: "New to board games or played just a few" },
  { value: "Intermediate", label: "Intermediate", hint: "Play now and then and know the common games" },
  { value: "Experienced", label: "Experienced", hint: "Play regularly and enjoy complex games" },
];

export const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = ["Beginner", "Intermediate", "Experienced"];

export const MODE_LABELS: Record<RecommendationMode, string> = {
  personal: "My Collection",
  game_night: "Game Night",
};

/** Backend limits for `categories` (RecommendationRequest schema). */
const MAX_CATEGORIES = 50;
const MAX_CATEGORY_LENGTH = 100;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Raw answers. Numeric answers are kept as text so a half-typed value
 * survives Back/Next; they are parsed and validated when building the request.
 *
 * playerCount and gameNightId are both kept when the mode changes (so switching back
 * restores the earlier choice), but only the one for the selected mode is ever sent.
 */
export interface QuestionnaireAnswers {
  mode: RecommendationMode | null;
  /** Personal mode only. */
  playerCount: string;
  /** Game-night mode only. Chosen from GET /api/game-nights, never typed in. */
  gameNightId: number | null;
  maxPlaytime: string;
  categories: string[];
  /** null means "no preference": the field is omitted from the request. */
  experienceLevel: ExperienceLevel | null;
}

export interface QuestionnaireState {
  step: StepIndex;
  answers: QuestionnaireAnswers;
}

export const INITIAL_ANSWERS: QuestionnaireAnswers = {
  mode: null,
  playerCount: "",
  gameNightId: null,
  maxPlaytime: "",
  categories: [],
  experienceLevel: null,
};

export const INITIAL_STATE: QuestionnaireState = { step: 0, answers: INITIAL_ANSWERS };

export type QuestionnaireAction =
  | { type: "setMode"; mode: RecommendationMode }
  | { type: "setPlayerCount"; value: string }
  | { type: "setGameNight"; id: number | null }
  | { type: "setMaxPlaytime"; value: string }
  | { type: "toggleCategory"; category: string }
  | { type: "setExperience"; value: ExperienceLevel | null }
  | { type: "goToStep"; step: StepIndex }
  | { type: "reset" };

export function questionnaireReducer(
  state: QuestionnaireState,
  action: QuestionnaireAction,
): QuestionnaireState {
  const setAnswers = (patch: Partial<QuestionnaireAnswers>): QuestionnaireState => ({
    ...state,
    answers: { ...state.answers, ...patch },
  });

  switch (action.type) {
    case "setMode":
      return setAnswers({ mode: action.mode });
    case "setPlayerCount":
      return setAnswers({ playerCount: action.value });
    case "setGameNight":
      return setAnswers({ gameNightId: action.id });
    case "setMaxPlaytime":
      return setAnswers({ maxPlaytime: action.value });
    case "toggleCategory": {
      const selected = state.answers.categories;
      return setAnswers({
        categories: selected.includes(action.category)
          ? selected.filter((category) => category !== action.category)
          : [...selected, action.category],
      });
    }
    case "setExperience":
      return setAnswers({ experienceLevel: action.value });
    case "goToStep":
      return { ...state, step: action.step };
    case "reset":
      return INITIAL_STATE;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type QuestionnaireField = "mode" | "playerCount" | "gameNightId" | "maxPlaytime" | "categories";
export type FieldErrors = Partial<Record<QuestionnaireField, string>>;

/** Strict positive integer parsing: "3" → 3; "3.5", "-1", "3a", "" → null. */
export function parsePositiveInteger(value: string, max: number): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed >= 1 && parsed <= max ? parsed : null;
}

/** Errors for the fields on one step. An empty object means the step is complete. */
export function validateStep(step: StepIndex, answers: QuestionnaireAnswers): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 0) {
    if (answers.mode === null) {
      errors.mode = "Choose how you want to find games.";
    } else if (answers.mode === "personal") {
      if (answers.playerCount.trim() === "") {
        errors.playerCount = "Choose how many people will be playing.";
      } else if (parsePositiveInteger(answers.playerCount, MAX_PLAYERS) === null) {
        errors.playerCount = `Enter a whole number of players from 1 to ${MAX_PLAYERS}.`;
      }
    } else if (answers.gameNightId === null) {
      errors.gameNightId = "Choose one of your game nights.";
    }
  }

  if (step === 1) {
    if (answers.maxPlaytime.trim() === "") {
      errors.maxPlaytime = "Choose how long you want to play.";
    } else if (parsePositiveInteger(answers.maxPlaytime, MAX_PLAYTIME_MINUTES) === null) {
      errors.maxPlaytime = `Enter a whole number of minutes from 1 to ${MAX_PLAYTIME_MINUTES}.`;
    }

    if (
      answers.categories.length > MAX_CATEGORIES ||
      answers.categories.some((category) => category.trim().length > MAX_CATEGORY_LENGTH)
    ) {
      errors.categories = `Choose at most ${MAX_CATEGORIES} categories.`;
    }
  }

  // Step 2 (experience) is optional, and step 3 is the review.
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

export type BuildResult =
  | { ok: true; request: RecommendationRequest }
  | { ok: false; step: StepIndex; errors: FieldErrors };

/**
 * Builds the exact POST /api/recommendations body from the answers.
 *
 * - Only the identifier for the selected mode is included, so a stale
 *   player_count or game_night_id from the other mode is never sent.
 * - Optional fields are omitted, never sent as null.
 * - On failure, returns the first incomplete step and its errors.
 */
export function buildRecommendationRequest(answers: QuestionnaireAnswers): BuildResult {
  for (const step of [0, 1, 2] as const) {
    const errors = validateStep(step, answers);
    if (hasErrors(errors)) return { ok: false, step, errors };
  }

  // Validation above guarantees these parse; the checks just narrow the types.
  const maxPlaytime = parsePositiveInteger(answers.maxPlaytime, MAX_PLAYTIME_MINUTES);
  if (maxPlaytime === null) return { ok: false, step: 1, errors: { maxPlaytime: "Invalid playtime." } };

  const optional: { categories?: string[]; experience_level?: ExperienceLevel } = {};
  const categories = uniqueCategories(answers.categories);
  if (categories.length > 0) optional.categories = categories;
  if (answers.experienceLevel !== null) optional.experience_level = answers.experienceLevel;

  if (answers.mode === "personal") {
    const playerCount = parsePositiveInteger(answers.playerCount, MAX_PLAYERS);
    if (playerCount === null) return { ok: false, step: 0, errors: { playerCount: "Invalid player count." } };
    return {
      ok: true,
      request: { mode: "personal", player_count: playerCount, max_playtime: maxPlaytime, ...optional },
    };
  }

  if (answers.mode === "game_night" && answers.gameNightId !== null) {
    return {
      ok: true,
      request: {
        mode: "game_night",
        game_night_id: answers.gameNightId,
        max_playtime: maxPlaytime,
        ...optional,
      },
    };
  }

  return { ok: false, step: 0, errors: { mode: "Choose how you want to find games." } };
}

/** Trimmed, non-blank and de-duplicated case-insensitively (the backend does the same). */
function uniqueCategories(categories: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const category of categories) {
    const trimmed = category.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** e.g. "60" → "Up to 1 hour", "45" → "Up to 45 min" */
export function formatMaxPlaytime(value: string): string {
  const preset = PLAYTIME_PRESETS.find((option) => option.value === value.trim());
  if (preset) return preset.label;
  const minutes = parsePositiveInteger(value, MAX_PLAYTIME_MINUTES);
  return minutes === null ? "Not set" : `Up to ${minutes} min`;
}

export function formatExperience(value: ExperienceLevel | null): string {
  return EXPERIENCE_OPTIONS.find((option) => option.value === value)?.label ?? "No preference";
}
