import { getApiErrorInfo } from "@/api/errors";
import { parseDateTimeLocalValue } from "@/lib/game-nights/details";
import { gameNightPath } from "@/lib/routes";
import type { GameNightCreate, GameNightResponse } from "@/types/game-night";

/** The Create Game Night form fields, as the inputs hold them. */
export interface CreateFormValues {
  name: string;
  /** `<input type="datetime-local">` value in the viewer's time zone. */
  startsAt: string;
  location: string;
  notes: string;
}

export const EMPTY_CREATE_FORM: CreateFormValues = { name: "", startsAt: "", location: "", notes: "" };

/**
 * The POST body, or an error message when the date can't be used.
 * Only ids that are still in the loaded collection / friends list are sent, so a stale
 * selection can never reference another user's games or friends.
 */
export function buildCreateBody(
  values: CreateFormValues,
  gameIds: readonly number[],
  inviteeIds: readonly number[],
  ownedGameIds: ReadonlySet<number>,
  friendIds: ReadonlySet<number>,
): { body: GameNightCreate } | { error: string } {
  const startsAt = parseDateTimeLocalValue(values.startsAt);
  if (!startsAt) return { error: "Enter a valid date and time." };

  return {
    body: {
      name: values.name.trim(),
      starts_at: startsAt.toISOString(),
      location: values.location.trim(),
      notes: values.notes.trim() || null,
      game_ids: gameIds.filter((id) => ownedGameIds.has(id)),
      invitee_ids: inviteeIds.filter((id) => friendIds.has(id)),
    },
  };
}

/** The backend's plain-text `detail` for expected rejections, otherwise a generic message. */
export function createErrorMessage(error: unknown): string {
  const info = getApiErrorInfo(error);
  if (info.detail && ["bad_request", "forbidden", "not_found"].includes(info.kind)) return info.detail;
  if (info.kind === "validation") return "Please check the details and try again.";
  if (info.kind === "network") return "Couldn't reach the server. Check your connection and try again.";
  return "Unable to create game night. Please try again.";
}

export type SubmitOutcome = { status: "created"; path: string } | { status: "error"; message: string } | { status: "stale" };

/**
 * Sends the POST and, on success, navigates to the new night's details page.
 * `isCurrent` is checked after the request: when the page was left or the user changed
 * meanwhile, nothing is navigated or reported.
 */
export async function submitGameNight(
  body: GameNightCreate,
  deps: {
    create: (body: GameNightCreate) => Promise<GameNightResponse>;
    navigate: (path: string) => void;
    isCurrent: () => boolean;
  },
): Promise<SubmitOutcome> {
  try {
    const created = await deps.create(body);
    if (!deps.isCurrent()) return { status: "stale" };
    const path = gameNightPath(created.id);
    deps.navigate(path);
    return { status: "created", path };
  } catch (error) {
    if (!deps.isCurrent()) return { status: "stale" };
    return { status: "error", message: createErrorMessage(error) };
  }
}
