/**
 * Central list of app paths so the navbar, page links and router stay in sync.
 * Paths marked PLACEHOLDER render the "Coming soon" page until the real page exists.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  findGame: "/find-a-game", // PLACEHOLDER
  browse: "/browse", // PLACEHOLDER
  collection: "/collection", // PLACEHOLDER
  messages: "/messages", // PLACEHOLDER
  createGameNight: "/game-nights/new", // PLACEHOLDER
} as const;
