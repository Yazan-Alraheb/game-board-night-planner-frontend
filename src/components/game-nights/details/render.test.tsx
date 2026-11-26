/// <reference types="bun" />
// Static-render checks with react-dom/server (no DOM or extra test framework needed).
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import GameNightCard from "@/components/home/GameNightCard";
import OverviewGameNightCard from "@/components/game-nights/OverviewGameNightCard";
import AttendeesSection from "@/components/game-nights/details/AttendeesSection";
import SelectedGamesSection from "@/components/game-nights/details/SelectedGamesSection";
import type { PublicUser } from "@/types/friend";
import type { GameNightMember, GameNightResponse } from "@/types/game-night";

const NOW = new Date("2026-11-25T12:00:00Z").getTime();

const user = (id: number, name: string, username: string): PublicUser => ({
  id,
  name,
  username,
  bio: null,
  avatar_url: null,
});

const night: GameNightResponse = {
  id: 42,
  host_id: 1,
  name: "Friday Strategy Night",
  starts_at: "2026-11-28T03:30:00Z",
  location: "42 Maple Street",
  notes: null,
  created_at: "2026-11-01T00:00:00Z",
};

const members: GameNightMember[] = [
  { user: user(1, "Hana Host", "hana"), status: "accepted" },
  { user: user(2, "Gus Guest", "gus"), status: "accepted" },
  { user: user(3, "Pia Pending", "pia_with_a_really_long_usernam32"), status: "pending" },
  { user: user(4, "Dan Declined", "dan"), status: "declined" },
];

/** True if an <a> or <button> contains another <a> or <button>. */
function hasNestedInteractive(html: string): boolean {
  const tags = html.match(/<\/?(a|button)\b[^>]*>/g) ?? [];
  let depth = 0;
  for (const tag of tags) {
    if (tag.startsWith("</")) depth--;
    else if (++depth > 1) return true;
  }
  return false;
}

describe("links to the details page", () => {
  test("the homepage card links to /game-nights/{id}", () => {
    const html = renderToStaticMarkup(<GameNightCard gameNight={night} role="hosting" members={members} />);
    expect(html).toContain('href="/game-nights/42"');
    expect(html).toContain("View details");
    expect(hasNestedInteractive(html)).toBe(false);
  });

  test("the overview card links to its own event, without nesting the RSVP buttons", () => {
    const html = renderToStaticMarkup(
      <OverviewGameNightCard
        entry={{ gameNight: { ...night, host_id: 1 }, members: { status: "success", members } }}
        userId={3}
        now={NOW}
        pendingRsvp={undefined}
        rsvpError={undefined}
        onRespond={() => {}}
        onRetryMembers={() => {}}
      />,
    );
    expect(html).toContain('href="/game-nights/42"');
    // The pending invitee sees Accept/Decline next to the link, never inside it.
    expect(html).toContain("Accept invitation to Friday Strategy Night");
    expect(hasNestedInteractive(html)).toBe(false);
  });
});

describe("attendee list", () => {
  const html = renderToStaticMarkup(
    <AttendeesSection
      members={{ status: "success", data: members }}
      hostId={1}
      userId={2}
      canInvite={false}
      onInvite={() => {}}
      onRetry={() => {}}
    />,
  );

  test("counts the host as going; pending and declined are not going", () => {
    expect(html).toContain("2 going · 1 awaiting reply · 1 declined");
  });

  test("shows display names and @usernames from the backend", () => {
    expect(html).toContain("Hana Host");
    expect(html).toContain("@hana");
    expect(html).toContain("@pia_with_a_really_long_usernam32");
    expect(html).toContain("(you)");
  });

  test("guests don't get an Invite button", () => {
    expect(html).not.toContain("Invite friends");
  });

  test("a failed members request shows a retry, not an empty list", () => {
    const failed = renderToStaticMarkup(
      <AttendeesSection
        members={{ status: "error", error: { kind: "server", status: 500, detail: null } }}
        hostId={1}
        userId={1}
        canInvite
        onInvite={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(failed).toContain("Couldn&#x27;t load the attendees.");
    expect(failed).toContain("Retry");
    expect(failed).not.toContain("No attendees yet");
  });
});

describe("selected games section", () => {
  const game = (id: number, name: string) => ({
    id,
    name,
    description: null,
    minimum_players: 2,
    maximum_players: 4,
    playtime: 60,
    difficulty: "Medium",
    categories: [],
    image_url: null,
    rating: null,
    review_count: null,
    instructions: null,
  });
  const games = {
    status: "success" as const,
    data: [
      { game: game(1, "Azul"), owners: [members[0].user], selected: true },
      { game: game(2, "Wingspan"), owners: [members[1].user], selected: false },
    ],
  };
  const render = (canManage: boolean, data = games) =>
    renderToStaticMarkup(
      <SelectedGamesSection games={data} canManage={canManage} pendingGameIds={new Set()} onSelect={() => {}} onRetry={() => {}} />,
    );

  test("selected games and other owned games are listed separately, with owners", () => {
    const html = render(false);
    const [selectedPart, ownedPart] = html.split("Also in attendees");
    expect(selectedPart).toContain("Azul");
    expect(selectedPart).not.toContain("Wingspan");
    expect(ownedPart).toContain("Wingspan");
    expect(html).toContain("Owned by Hana Host");
    expect(html).toContain("Medium");
  });

  test("only the host gets Add/Remove controls", () => {
    expect(render(false)).not.toContain("Remove");
    expect(render(false)).not.toContain("Add to game night");
    expect(render(true)).toContain("Remove");
    expect(render(true)).toContain("Add to game night");
  });

  test("no selected games shows an empty state", () => {
    const html = render(false, { status: "success", data: [] });
    expect(html).toContain("No games selected yet.");
    expect(html).toContain("The host hasn&#x27;t picked any games yet.");
  });
});
