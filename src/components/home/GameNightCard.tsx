import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import AttendeeAvatars from "@/components/home/AttendeeAvatars";
import { formatEventDate } from "@/lib/format";
import { summarizeAttendees, type GameNightRole } from "@/lib/home/upcoming-game-nights";
import { cn } from "@/lib/utils";
import type { GameNightMember, GameNightResponse } from "@/types/game-night";

const ROLE_LABELS: Record<GameNightRole, string> = {
  hosting: "Hosting",
  going: "Going",
  invited: "Invited",
  declined: "Declined",
};

interface GameNightCardProps {
  gameNight: GameNightResponse;
  role: GameNightRole;
  /** null when the members couldn't be loaded. */
  members: readonly GameNightMember[] | null;
}

function AttendeeRow({ members }: { members: readonly GameNightMember[] | null }) {
  if (members === null) {
    return <p className="text-sm text-muted-foreground">Attendees couldn&apos;t be loaded.</p>;
  }

  const { going, pendingCount } = summarizeAttendees(members);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {going.length > 0 && <AttendeeAvatars attendees={going} />}
      <span className="text-muted-foreground">
        {going.length} going
        {pendingCount > 0 && ` · ${pendingCount} pending`}
      </span>
    </div>
  );
}

/** Presentational card for one game night. Not a link: there is no detail page yet. */
function GameNightCard({ gameNight, role, members }: GameNightCardProps) {
  const { name, starts_at, location } = gameNight;

  return (
    <Card className="gap-0 rounded-2xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <h3 className="min-w-0 font-heading text-xl font-bold tracking-tight break-words">{name}</h3>
        <Badge
          className={cn(
            "h-auto shrink-0 px-3 py-1 text-sm font-medium",
            role === "declined" ? "bg-muted text-muted-foreground" : "bg-brand-soft text-brand-strong",
          )}
        >
          {ROLE_LABELS[role]}
        </Badge>
      </div>

      <p className="mt-2 text-base text-muted-foreground sm:text-lg">
        <time dateTime={starts_at}>{formatEventDate(starts_at)}</time>
      </p>

      <div className="mt-5">
        <AttendeeRow members={members} />
      </div>

      <p className="mt-5 flex items-center gap-2 text-muted-foreground">
        <MapPin className="size-4 shrink-0 text-cta" aria-hidden="true" />
        <span className="sr-only">Location: </span>
        <span className="min-w-0 break-words">{location}</span>
      </p>
    </Card>
  );
}

export default GameNightCard;
