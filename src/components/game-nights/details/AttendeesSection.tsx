import type { ReactNode } from "react";
import { CircleCheck, CircleX, Crown, MailQuestion, RotateCcw, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import type { Resource } from "@/hooks/useGameNightDetails";
import { getInitials, placeholderColor } from "@/lib/format";
import { groupAttendees } from "@/lib/game-nights/details";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types/friend";
import type { GameNightMember } from "@/types/game-night";

interface StatusStyle {
  label: string;
  icon: LucideIcon;
  className: string;
}

// Icon + text for every status, so it never relies on colour alone.
const STATUS: Record<"host" | GameNightMember["status"], StatusStyle> = {
  host: { label: "Host", icon: Crown, className: "bg-brand-strong text-brand-foreground" },
  accepted: { label: "Going", icon: CircleCheck, className: "bg-brand-soft text-brand-strong" },
  pending: {
    label: "Awaiting reply",
    icon: MailQuestion,
    className: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  },
  declined: { label: "Declined", icon: CircleX, className: "bg-muted text-foreground/75 ring-1 ring-border" },
};

export function MemberAvatar({ user, className }: { user: PublicUser; className?: string }) {
  return (
    <Avatar size="lg" className={className}>
      {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
      <AvatarFallback className={cn("text-xs font-semibold", placeholderColor(user.id))}>
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Display name with @username below, as on the Friends pages. Long names wrap instead of overflowing. */
export function UserName({ user, isMe = false }: { user: PublicUser; isMe?: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-medium break-words">
        {user.name}
        {isMe && <span className="font-normal text-muted-foreground"> (you)</span>}
      </span>
      {user.username && (
        <span className="block text-sm font-medium break-all text-brand-strong">@{user.username}</span>
      )}
    </span>
  );
}

function MemberRow({ member, kind, isMe }: { member: GameNightMember; kind: keyof typeof STATUS; isMe: boolean }) {
  const style = STATUS[kind];
  const Icon = style.icon;
  return (
    <li className="flex items-center gap-3 py-2">
      <MemberAvatar user={member.user} />
      <UserName user={member.user} isMe={isMe} />
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
          style.className,
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {style.label}
      </span>
    </li>
  );
}

function Group({ title, children, count }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title} <span className="tabular-nums">({count})</span>
      </h3>
      <ul className="mt-1 divide-y divide-border/60">{children}</ul>
    </section>
  );
}

interface AttendeesSectionProps {
  members: Resource<GameNightMember[]>;
  hostId: number;
  userId: number;
  canInvite: boolean;
  onInvite: () => void;
  onRetry: () => void;
}

function AttendeesSection({ members, hostId, userId, canInvite, onInvite, onRetry }: AttendeesSectionProps) {
  return (
    <Card className="gap-0 rounded-2xl p-6 text-base">
      <section aria-labelledby="attendees-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="attendees-heading" className="font-heading text-xl font-bold">
            Attendees
          </h2>
          {canInvite && (
            <button
              type="button"
              onClick={onInvite}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Invite friends
            </button>
          )}
        </div>

        <div className="mt-4">
          <AttendeesBody members={members} hostId={hostId} userId={userId} onRetry={onRetry} />
        </div>
      </section>
    </Card>
  );
}

function AttendeesBody({
  members,
  hostId,
  userId,
  onRetry,
}: Pick<AttendeesSectionProps, "members" | "hostId" | "userId" | "onRetry">) {
  if (members.status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Loading attendees…</span>
        <ul aria-hidden="true" className="space-y-3">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex items-center gap-3">
              <span className="size-10 animate-pulse rounded-full bg-muted" />
              <span className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (members.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <p role="alert" className="text-foreground/80">
          Couldn&apos;t load the attendees.
        </p>
        <RetryButton onClick={onRetry} label="loading attendees" />
      </div>
    );
  }

  const groups = groupAttendees(members.data, hostId);
  const total = members.data.length;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {groups.accepted.length + (groups.host ? 1 : 0)} going · {groups.pending.length} awaiting reply ·{" "}
        {groups.declined.length} declined
      </p>
      {total === 0 ? (
        <p className="text-muted-foreground">No attendees yet.</p>
      ) : (
        <>
          <Group title="Host" count={groups.host ? 1 : 0}>
            {groups.host && <MemberRow member={groups.host} kind="host" isMe={groups.host.user.id === userId} />}
          </Group>
          <Group title="Going" count={groups.accepted.length}>
            {groups.accepted.map((member) => (
              <MemberRow key={member.user.id} member={member} kind="accepted" isMe={member.user.id === userId} />
            ))}
          </Group>
          <Group title="Awaiting reply" count={groups.pending.length}>
            {groups.pending.map((member) => (
              <MemberRow key={member.user.id} member={member} kind="pending" isMe={member.user.id === userId} />
            ))}
          </Group>
          <Group title="Declined" count={groups.declined.length}>
            {groups.declined.map((member) => (
              <MemberRow key={member.user.id} member={member} kind="declined" isMe={member.user.id === userId} />
            ))}
          </Group>
        </>
      )}
    </>
  );
}

export function RetryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      Retry
      <span className="sr-only"> {label}</span>
    </button>
  );
}

export default AttendeesSection;
