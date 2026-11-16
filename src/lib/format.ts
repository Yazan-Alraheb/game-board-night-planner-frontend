const eventDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const eventTimeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** "3–4" or "30" when both ends are equal. */
function formatRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

/** e.g. "3–4 players", "1 player" */
export function formatPlayerRange(min: number, max: number): string {
  return `${formatRange(min, max)} ${max === 1 ? "player" : "players"}`;
}

/** e.g. "60 min" */
export function formatPlaytime(minutes: number): string {
  return `${minutes} min`;
}

/** e.g. "4 players" */
export function formatPlayerCount(count: number): string {
  return `${count} ${count === 1 ? "player" : "players"}`;
}

/** e.g. "Sat, Sep 26 · 7:00 PM" */
export function formatEventDate(isoDate: string): string {
  const date = new Date(isoDate);
  return `${eventDateFormat.format(date)} · ${eventTimeFormat.format(date)}`;
}

/** e.g. "Maria Lopez" → "ML" */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const PLACEHOLDER_COLORS = [
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
] as const;

/** Stable colour classes for image placeholders, picked from an id. */
export function placeholderColor(seed: number): string {
  return PLACEHOLDER_COLORS[Math.abs(seed) % PLACEHOLDER_COLORS.length];
}
