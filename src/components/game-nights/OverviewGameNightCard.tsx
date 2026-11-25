import { CalendarDays, MapPin, RotateCcw, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import AttendeeAvatars from "@/components/home/AttendeeAvatars";
import GameNightStatusBadge from "@/components/game-nights/GameNightStatusBadge";
import RsvpActions from "@/components/game-nights/RsvpActions";
import type { RsvpAnswer } from "@/hooks/useGameNightsOverview";
import { isPastGameNight } from "@/lib/find-game/game-nights";
import { formatEventDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  findHost,
  getAvailableAnswers,
  getMyStatus,
  loadedMembers,
  summarizeAttendees,
  type OverviewEntry,
} from "@/lib/game-nights/overview";

const fullDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });

interface OverviewGameNightCardProps {
  entry: OverviewEntry;
  userId: number;
  now: number;
  pendingRsvp: RsvpAnswer | undefined;
  rsvpError: string | undefined;
  onRespond: (answer: RsvpAnswer) => void;
  onRetryMembers: () => void;
}

function OverviewGameNightCard({
  entry,
  userId,
  now,
  pendingRsvp,
  rsvpError,
  onRespond,
  onRetryMembers,
}: OverviewGameNightCardProps) {
  const { gameNight } = entry;
  const members = loadedMembers(entry.members);
  const status = getMyStatus(gameNight, userId, members);
  const past = isPastGameNight(gameNight, now);
  const isHost = gameNight.host_id === userId;
  const host = members ? findHost(members, gameNight.host_id) : null;
  const headingId = `game-night-${gameNight.id}-name`;
  const invited = status === "invited" && !past;
  const available = getAvailableAnswers(gameNight, userId, members, now);
  // Keep the button being saved visible even if a background refresh changed the status meanwhile.
  const answers = available.length > 0 ? available : pendingRsvp ? [pendingRsvp] : [];

  return (
    <Card className={cn("h-full gap-0 rounded-2xl p-6 sm:p-7", invited && "ring-2 ring-amber-300")}>
      <article aria-labelledby={headingId} className="flex h-full flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 id={headingId} className="min-w-0 font-heading text-xl font-bold tracking-tight break-words">
            {gameNight.name}
          </h3>
          <GameNightStatusBadge status={status} past={past} />
        </div>

        <dl className="mt-4 space-y-2 text-muted-foreground">
          <div className="flex items-start gap-2">
            <dt>
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-cta" aria-hidden="true" />
              <span className="sr-only">Date and time</span>
            </dt>
            <dd>
              <time dateTime={gameNight.starts_at} title={fullDateFormat.format(new Date(gameNight.starts_at))}>
                {formatEventDate(gameNight.starts_at)}
              </time>
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <dt>
              <MapPin className="mt-0.5 size-4 shrink-0 text-cta" aria-hidden="true" />
              <span className="sr-only">Location</span>
            </dt>
            <dd className="min-w-0 break-words">{gameNight.location}</dd>
          </div>
          {(isHost || host) && (
            <div className="flex items-start gap-2">
              <dt>
                <UserRound className="mt-0.5 size-4 shrink-0 text-cta" aria-hidden="true" />
                <span className="sr-only">Host</span>
              </dt>
              <dd className="min-w-0 break-words">
                {isHost ? "Hosted by you" : `Hosted by ${host?.name}`}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-5">
          <Attendees entry={entry} onRetry={onRetryMembers} statusUnknown={status === null} />
        </div>

        {answers.length > 0 && (
          <div className="mt-auto pt-6">
            <RsvpActions
              gameNightName={gameNight.name}
              answers={answers}
              pending={pendingRsvp}
              onRespond={onRespond}
            />
          </div>
        )}

        {rsvpError && (
          <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {rsvpError}
          </p>
        )}
      </article>
    </Card>
  );
}

function Attendees({
  entry,
  onRetry,
  statusUnknown,
}: {
  entry: OverviewEntry;
  onRetry: () => void;
  statusUnknown: boolean;
}) {
  if (entry.members.status === "loading") {
    return (
      <div role="status" className="flex items-center gap-3">
        <span className="flex -space-x-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span key={index} className="size-10 animate-pulse rounded-full bg-muted ring-2 ring-white" />
          ))}
        </span>
        <span className="text-sm text-muted-foreground">Loading attendees…</span>
      </div>
    );
  }

  if (entry.members.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <p className="text-foreground/80">
          {statusUnknown ? "Couldn't load your RSVP status or attendees." : "Couldn't load attendees."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Retry
          <span className="sr-only"> loading attendees for {entry.gameNight.name}</span>
        </button>
      </div>
    );
  }

  const { going, pendingCount } = summarizeAttendees(entry.members.members, entry.gameNight.host_id);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {going.length > 0 && <AttendeeAvatars attendees={going} />}
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground">{going.length} going</span>
        {pendingCount > 0 && <> · {pendingCount} awaiting reply</>}
      </p>
    </div>
  );
}

export default OverviewGameNightCard;
