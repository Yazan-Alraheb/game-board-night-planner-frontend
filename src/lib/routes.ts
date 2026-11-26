/**
 * Central list of app paths so the navbar, page links and router stay in sync.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  findGame: "/find-a-game",
  recommendations: "/recommendations",
  browse: "/browse", // PLACEHOLDER
  collection: "/collection", // PLACEHOLDER
  messages: "/messages",
  gameNights: "/game-nights",
  createGameNight: "/game-nights/new",
  register: "/register",
  friends: "/friends",
  profile: "/profile",
} as const;

/** /game-nights/{id}: one game night's details page. */
export function gameNightPath(id: number): string {
  return `${ROUTES.gameNights}/${id}`;
}
