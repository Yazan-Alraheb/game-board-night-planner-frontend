import { ROUTES } from "@/lib/routes";

const allowed = new Set<string>([
  ROUTES.home,
  ROUTES.dashboard,
  ROUTES.findGame,
  ROUTES.browse,
  ROUTES.collection,
  ROUTES.messages,
  ROUTES.createGameNight,
  ROUTES.friends,
]);

export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((char) => char.charCodeAt(0) < 32)
) {
  return ROUTES.home;
}
  const pathname = value.split(/[?#]/)[0];
  return allowed.has(pathname) ? value : ROUTES.home;
}
