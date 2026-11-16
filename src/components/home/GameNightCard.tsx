import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import AttendeeAvatars from "@/components/home/AttendeeAvatars";
import { formatEventDate, formatPlayerCount } from "@/lib/format";
import type { GameNight, GameNightRole } from "@/types/game";

const ROLE_LABELS: Record<GameNightRole, string> = {
  host: "Hosting",
  invited: "Invited",
};

interface GameNightCardProps {
  gameNight: GameNight;
}

function GameNightCard({ gameNight }: GameNightCardProps) {
  const { title, starts_at, location, my_role, attendees } = gameNight;

  return (
    <Card className="gap-0 rounded-2xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-heading text-xl font-bold tracking-tight">{title}</h3>
        <Badge className="h-auto shrink-0 bg-brand-soft px-3 py-1 text-sm font-medium text-brand-strong">
          {ROLE_LABELS[my_role]}
        </Badge>
      </div>

      <p className="mt-2 text-base text-muted-foreground sm:text-lg">
        <time dateTime={starts_at}>{formatEventDate(starts_at)}</time>
      </p>

      <div className="mt-5 flex items-center gap-3">
        <AttendeeAvatars attendees={attendees} />
        <span className="text-muted-foreground">{formatPlayerCount(attendees.length)}</span>
      </div>

      <p className="mt-5 flex items-center gap-2 text-muted-foreground">
        <MapPin className="size-4 shrink-0 text-cta" aria-hidden="true" />
        <span className="sr-only">Location: </span>
        {location}
      </p>
    </Card>
  );
}

export default GameNightCard;
