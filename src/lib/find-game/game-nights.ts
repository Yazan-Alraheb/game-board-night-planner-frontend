import type { LazyResource } from "@/hooks/useLazyResource";
import type { GameNightResponse } from "@/types/game-night";

function startTime(gameNight: GameNightResponse): number {
  return new Date(gameNight.starts_at).getTime();
}

export function isPastGameNight(gameNight: GameNightResponse, now: number): boolean {
  return startTime(gameNight) < now;
}

/** Upcoming events first (soonest first), then past events (most recent first). */
export function sortGameNights(gameNights: GameNightResponse[], now: number): GameNightResponse[] {
  const upcoming = gameNights
    .filter((gameNight) => !isPastGameNight(gameNight, now))
    .sort((a, b) => startTime(a) - startTime(b));
  const past = gameNights
    .filter((gameNight) => isPastGameNight(gameNight, now))
    .sort((a, b) => startTime(b) - startTime(a));
  return [...upcoming, ...past];
}

/**
 * The selected game night, only if it is confirmed by the user's loaded list.
 * Returns undefined when nothing is selected, the list hasn't loaded (or failed),
 * or the id is no longer in the list.
 */
export function findSelectedGameNight(
  gameNights: LazyResource<GameNightResponse[]>,
  selectedId: number | null,
): GameNightResponse | undefined {
  if (selectedId === null || gameNights.status !== "success") return undefined;
  return gameNights.data.find((gameNight) => gameNight.id === selectedId);
}
