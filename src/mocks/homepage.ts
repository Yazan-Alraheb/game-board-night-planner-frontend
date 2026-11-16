/**
 * ⚠️ TEMPORARY MOCK DATA — not from the backend.
 *
 * Used for the navbar user and Upcoming Game Nights until those load real data.
 * Discover Games already uses GET /api/games, so it has no mock data here.
 * Delete this file once the homepage loads real data.
 */
import type { GameNight, UserSummary } from "@/types/game";

const maria: UserSummary = { id: 2, display_name: "Maria Lopez", avatar_url: null };
const jamal: UserSummary = { id: 3, display_name: "Jamal Carter", avatar_url: null };
const priya: UserSummary = { id: 4, display_name: "Priya Shah", avatar_url: null };
const tom: UserSummary = { id: 5, display_name: "Tom Becker", avatar_url: null };

export const mockCurrentUser: UserSummary = {
  id: 1,
  display_name: "Alex Morgan",
  avatar_url: null,
};

export const mockUpcomingGameNights: GameNight[] = [
  {
    id: 1,
    title: "Friday Strategy Night",
    starts_at: "2026-09-26T19:00:00",
    location: "42 Maple Street, Apt 3B",
    my_role: "host",
    attendees: [mockCurrentUser, jamal, priya, tom],
  },
  {
    id: 2,
    title: "Casual Game Sunday",
    starts_at: "2026-10-04T15:00:00",
    location: "Maria's Place",
    my_role: "invited",
    attendees: [mockCurrentUser, jamal, maria],
  },
];

