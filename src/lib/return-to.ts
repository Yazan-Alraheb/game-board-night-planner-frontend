import { ROUTES } from "@/lib/routes";

/** Fixed pages a user may be sent back to after logging in or registering. */
const allowed = new Set<string>([
  ROUTES.home,
  ROUTES.findGame,
  ROUTES.recommendations,
  ROUTES.browse,
  ROUTES.collection,
  ROUTES.messages,
  ROUTES.gameNights,
  ROUTES.createGameNight,
  ROUTES.friends,
  ROUTES.profile,
]);

/** A positive database id as it appears in a path: no sign, no leading zero, fits a 32-bit int. */
const ID = "[1-9][0-9]{0,9}";
const MAX_ID = 2_147_483_647;

/** Pages with one numeric id: /game-nights/{id} and /games/{id}. */
const nestedRoutes: readonly RegExp[] = [
  new RegExp(`^${ROUTES.gameNights}/(${ID})$`),
  new RegExp(`^/games/(${ID})$`),
];

function isAllowedPath(pathname: string): boolean {
  if (allowed.has(pathname)) return true;

  return nestedRoutes.some((pattern) => {
    const match = pattern.exec(pathname);
    return match !== null && Number(match[1]) <= MAX_ID;
  });
}

/**
 * Where to go after login: `value` when it is a known internal page, otherwise Home.
 * Only root-relative paths are accepted (no protocol, `//host` or backslashes), so this
 * can never redirect to another site. A query string or hash on an allowed page is kept.
 */
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  ) {
    return ROUTES.home;
  }

  const pathname = value.split(/[?#]/)[0];
  return isAllowedPath(pathname) ? value : ROUTES.home;
}
