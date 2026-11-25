import type { PreferenceUpdateRequest } from "@/types/preference";

export const PROFILE_CATEGORIES = [
  "Strategy",
  "Family",
  "Party",
  "Abstract",
  "Cooperative",
  "Deck Building",
] as const;

export const PLAYTIME_OPTIONS = [
  { value: 25, label: "Quick (< 30 min)" },
  { value: 60, label: "Medium (30–90 min)" },
  { value: 120, label: "Long (90+ min)" },
] as const;

// Default values for users without saved preferences
export const DEFAULT_PREFERENCES: PreferenceUpdateRequest = {
  favorite_categories: [],
  disliked_categories: [],
  preferred_difficulty: null,
  preferred_playtime: null,
};

// Add or remove a selected category
export function toggleCategory(
  categories: string[],
  category: string
): string[] {
  return categories.includes(category)
    ? categories.filter((item) => item !== category)
    : [...categories, category];
}

// Determine which playtime option should be highlighted
export function getPlaytimeOption(
  minutes: number | null
): number | null {
  if (minutes === null) return null;
  if (minutes < 30) return 25;
  if (minutes <= 90) return 60;

  return 120;
}

// Format account creation date
export function formatMemberSince(
  createdAt: string
): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}
