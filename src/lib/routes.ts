/**
 * Central list of app paths so the navbar, page links and router stay in sync.
 * Paths marked PLACEHOLDER render the "Coming soon" page until the real page exists.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  findGame: "/find-a-game",
  recommendations: "/recommendations",
  browse: "/browse", // PLACEHOLDER
  collection: "/collection", // PLACEHOLDER
  messages: "/messages", // PLACEHOLDER
  gameNights: "/game-nights",
  createGameNight: "/game-nights/new", // PLACEHOLDER
  register: "/register",
  friends: "/friends",
} as const;
