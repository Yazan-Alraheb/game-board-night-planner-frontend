/**
 * Validation for recommendation results, from the API or from the session cache.
 *
 * Returns clean, typed copies in the backend's order, or null when anything
 * required is missing or has the wrong type. It never reorders or re-scores.
 */
import type { PublicUser } from "@/types/friend";
import type { Game } from "@/types/game";
import type { Recommendation } from "@/types/recommendation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function parseGame(value: unknown): Game | null {
  if (!isRecord(value)) return null;
  const { id, name, minimum_players, maximum_players, playtime, difficulty, categories } = value;

  if (!isFiniteNumber(id) || typeof name !== "string") return null;
  if (!isFiniteNumber(minimum_players) || !isFiniteNumber(maximum_players) || !isFiniteNumber(playtime)) {
    return null;
  }
  if (categories !== undefined && !Array.isArray(categories)) return null;

  return {
    id,
    name,
    description: optionalString(value.description),
    minimum_players,
    maximum_players,
    playtime,
    difficulty: typeof difficulty === "string" ? difficulty : "",
    categories: Array.isArray(categories)
      ? categories.filter((category): category is string => typeof category === "string")
      : [],
    image_url: optionalString(value.image_url),
    rating: optionalNumber(value.rating),
    review_count: optionalNumber(value.review_count),
    instructions: optionalString(value.instructions),
  };
}

function parseOwner(value: unknown): PublicUser | null {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.id) ||
    typeof value.name !== "string" ||
    typeof value.username !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    username: value.username,
    bio: optionalString(value.bio),
    avatar_url: optionalString(value.avatar_url),
  };
}

function parseRecommendation(value: unknown): Recommendation | null {
  if (!isRecord(value)) return null;

  const game = parseGame(value.game);
  const { score, reason, owners } = value;
  if (!game || !isFiniteNumber(score) || typeof reason !== "string" || !Array.isArray(owners)) {
    return null;
  }

  const parsedOwners = owners.map(parseOwner);
  if (parsedOwners.some((owner) => owner === null)) return null;

  return { game, score, reason, owners: parsedOwners as PublicUser[] };
}

/** Parses a `{ recommendations: [...] }` body. Returns null if it isn't one. */
export function parseRecommendationList(value: unknown): Recommendation[] | null {
  if (!isRecord(value) || !Array.isArray(value.recommendations)) return null;

  const parsed = value.recommendations.map(parseRecommendation);
  if (parsed.some((recommendation) => recommendation === null)) return null;

  return parsed as Recommendation[];
}
