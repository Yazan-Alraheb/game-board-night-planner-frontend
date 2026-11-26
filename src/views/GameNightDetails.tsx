"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  Crown,
  LogOut,
  MapPin,
  NotebookPen,
  Pencil,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getApiErrorInfo } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import GameNightStatusBadge from "@/components/game-nights/GameNightStatusBadge";
import RsvpActions from "@/components/game-nights/RsvpActions";
import { LoadErrorState, PRIMARY_LINK_CLASSES } from "@/components/game-nights/OverviewStates";
import AttendeesSection, { RetryButton } from "@/components/game-nights/details/AttendeesSection";
import ConfirmDialog from "@/components/game-nights/details/ConfirmDialog";
import EditGameNightForm, { type SaveOutcome } from "@/components/game-nights/details/EditGameNightForm";
import InviteFriendsDialog from "@/components/game-nights/details/InviteFriendsDialog";
import SelectedGamesSection from "@/components/game-nights/details/SelectedGamesSection";
import { buttonVariants } from "@/components/ui/button";
import { useGameNightDetails } from "@/hooks/useGameNightDetails";
import type { RsvpAnswer } from "@/hooks/useGameNightsOverview";
import { isPastGameNight } from "@/lib/find-game/game-nights";
import {
  describeDeleteError,
  describeGameActionError,
  describeInviteError,
  describeLeaveError,
  describeLoadError,
  describeUpdateError,
  getDetailsPermissions,
  getServerFieldErrors,
  memberIds,
  type DetailsPermissions,
} from "@/lib/game-nights/details";
import { setOverviewFlash } from "@/lib/game-nights/flash";
import { describeRsvpError, findHost, getMyStatus } from "@/lib/game-nights/overview";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { GameNightAvailableGame, GameNightMember, GameNightResponse, GameNightUpdate } from "@/types/game-night";
import type { PublicUser } from "@/types/friend";

/** Re-check every minute so the page notices when the night starts. */
const NOW_REFRESH_MS = 60_000;

const longDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

interface Notice {
  tone: "success" | "error";
  message: string;
}

type DialogKind = "delete" | "leave" | "invite";

function GameNightDetails({ id }: { id: number | null }) {
  const router = useRouter();
  const details = useGameNightDetails(id);
  const { userId, event, members, games } = details;

  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [rsvpPending, setRsvpPending] = useState<RsvpAnswer | undefined>(undefined);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [dialogPending, setDialogPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [pendingGames, setPendingGames] = useState<ReadonlySet<number>>(new Set());
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), NOW_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (id === null) return <NotFoundPage />;
  if (event.status === "loading" || userId === null) return <LoadingPage />;
  if (event.status === "error") {
    const problem = describeLoadError(event.error);
    if (!problem.retryable) return <NotFoundPage title={problem.title} message={problem.message} />;
    return (
      <PageShell title={<h1 className="font-heading text-4xl font-bold">Game night</h1>}>
        <LoadErrorState message={`${problem.title}. ${problem.message}`} onRetry={details.reloadAll} />
      </PageShell>
    );
  }

  const gameNight = event.data;
  const memberList = members.status === "success" ? members.data : null;
  const permissions = getDetailsPermissions(gameNight, userId, memberList, now);
  const past = isPastGameNight(gameNight, now);

  function showNotice(next: Notice) {
    setNotice(next);
  }

  function openDialog(kind: DialogKind) {
    setDialogError(null);
    setDialogPending(false);
    setDialog(kind);
  }

  function closeEditor(message?: string) {
    setEditing(false);
    if (message) showNotice({ tone: "success", message });
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }

  async function handleSave(payload: GameNightUpdate): Promise<SaveOutcome> {
    const result = await details.save(payload);
    if (!result) return { ok: "handled" };
    if (result.ok) {
      closeEditor(`Saved your changes to ${result.value.name}.`);
      return { ok: true };
    }

    const { message, outcome } = describeUpdateError(getApiErrorInfo(result.error));
    if (outcome === "gone") {
      details.markGone();
      return { ok: "handled" };
    }
    if (outcome === "reload") details.refreshQuietly();
    return { ok: false, message, fieldErrors: getServerFieldErrors(result.error) };
  }

  async function handleDelete() {
    setDialogPending(true);
    setDialogError(null);
    const result = await details.remove();
    if (!result) {
      setDialogPending(false);
      return;
    }
    if (result.ok) {
      // Keep the dialog busy while navigating, so it can't be confirmed twice.
      setOverviewFlash(`${gameNight.name} was permanently deleted.`);
      router.push(ROUTES.gameNights);
      return;
    }

    const { message, outcome } = describeDeleteError(getApiErrorInfo(result.error));
    if (outcome === "gone") {
      setOverviewFlash(message);
      router.push(ROUTES.gameNights);
      return;
    }
    setDialogPending(false);
    setDialogError(message);
    if (outcome === "reload") details.refreshQuietly();
  }

  async function handleLeave() {
    setDialogPending(true);
    setDialogError(null);
    const result = await details.leave();
    if (!result) {
      setDialogPending(false);
      return;
    }
    if (result.ok) {
      setOverviewFlash(`You left ${gameNight.name}.`);
      router.push(ROUTES.gameNights);
      return;
    }

    const { message, outcome } = describeLeaveError(getApiErrorInfo(result.error));
    if (outcome === "gone") {
      setOverviewFlash(message);
      router.push(ROUTES.gameNights);
      return;
    }
    setDialogPending(false);
    setDialogError(message);
    if (outcome === "reload") details.refreshQuietly();
  }

  async function handleRespond(answer: RsvpAnswer) {
    if (rsvpPending) return;
    setRsvpPending(answer);
    setRsvpError(null);
    const result = await details.respond(answer);
    setRsvpPending(undefined);
    if (!result) return;

    if (result.ok) {
      showNotice({
        tone: "success",
        message:
          result.value.status === "accepted"
            ? `You're going to ${gameNight.name}!`
            : `You declined ${gameNight.name}.`,
      });
      return;
    }

    const { message, refresh } = describeRsvpError(getApiErrorInfo(result.error), answer);
    if (!message) return;
    setRsvpError(message);
    if (refresh === "list") details.refreshQuietly();
    if (refresh === "members") void details.reloadMembers(true);
  }

  async function handleSelectGame(entry: GameNightAvailableGame, selected: boolean) {
    const gameId = entry.game.id;
    if (pendingGames.has(gameId)) return;
    setPendingGames((prev) => new Set(prev).add(gameId));
    const result = await details.setGame(entry, selected);
    setPendingGames((prev) => {
      const next = new Set(prev);
      next.delete(gameId);
      return next;
    });
    if (!result) return;

    if (result.ok) {
      showNotice({
        tone: "success",
        message: selected
          ? `Added ${entry.game.name} to the selected games.`
          : `Removed ${entry.game.name} from the selected games.`,
      });
      return;
    }

    const { message, outcome } = describeGameActionError(
      getApiErrorInfo(result.error),
      selected ? "add" : "remove",
      entry.game.name,
    );
    if (message) showNotice({ tone: "error", message });
    if (outcome === "reload") void details.reloadGames(true);
  }

  async function handleInvite(friend: PublicUser): Promise<string | null> {
    const result = await details.invite(friend);
    if (!result) return `The invitation to ${friend.name} is already being sent.`;
    if (result.ok) return null;

    const { message, outcome } = describeInviteError(getApiErrorInfo(result.error), friend.name);
    if (outcome === "reload") void details.reloadMembers(true);
    return message || `Couldn't invite ${friend.name}.`;
  }

  const host = memberList ? findHost(memberList, gameNight.host_id) : null;
  const hostName = permissions.isHost ? "You" : host?.name ?? null;

  return (
    <PageShell
      title={
        <div className="mt-4 flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 font-heading text-3xl font-bold break-words sm:text-4xl">{gameNight.name}</h1>
            <GameNightStatusBadge status={getMyStatus(gameNight, userId, memberList)} past={past} />
          </div>
          <p className="text-lg text-white/90">
            <time dateTime={gameNight.starts_at}>
              {longDateFormat.format(new Date(gameNight.starts_at))} · {timeFormat.format(new Date(gameNight.starts_at))}
            </time>
          </p>
        </div>
      }
    >
      <Notices notice={notice} onDismiss={() => setNotice(null)} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="gap-0 rounded-2xl p-6 text-base sm:p-8">
            {editing && permissions.canEdit ? (
              <EditGameNightForm
                gameNight={gameNight}
                onSave={handleSave}
                onCancel={() => closeEditor()}
                onNoChanges={() => closeEditor("Nothing changed, so there was nothing to save.")}
              />
            ) : (
              <EventInfo
                gameNight={gameNight}
                hostName={hostName}
                past={past}
                editButton={
                  permissions.canEdit && (
                    <Button
                      ref={editButtonRef}
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        setEditing(true);
                      }}
                      className="h-11 rounded-xl bg-brand-strong px-4 text-base font-semibold text-brand-foreground hover:bg-brand"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit details
                    </Button>
                  )
                }
              />
            )}
          </Card>

          <SelectedGamesSection
            games={games}
            canManage={permissions.canManageGames}
            pendingGameIds={pendingGames}
            onSelect={(entry, selected) => void handleSelectGame(entry, selected)}
            onRetry={() => void details.reloadGames()}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-6" aria-label="Your RSVP and attendees">
          <YourStatusCard
            gameNight={gameNight}
            permissions={permissions}
            members={members.status}
            past={past}
            rsvpPending={rsvpPending}
            rsvpError={rsvpError}
            onRespond={(answer) => void handleRespond(answer)}
            onRetryMembers={() => void details.reloadMembers()}
            onLeave={() => openDialog("leave")}
            onDelete={() => openDialog("delete")}
          />
          <AttendeesSection
            members={members}
            hostId={gameNight.host_id}
            userId={userId}
            canInvite={permissions.canInvite && members.status === "success"}
            onInvite={() => openDialog("invite")}
            onRetry={() => void details.reloadMembers()}
          />
        </aside>
      </div>

      {permissions.canDelete && (
        <ConfirmDialog
          open={dialog === "delete"}
          onOpenChange={(open) => !open && setDialog(null)}
          title="Delete this game night?"
          description={
            <>
              <p>
                <strong className="break-words">{gameNight.name}</strong> will be permanently deleted for everyone.
              </p>
              <p>
                {deleteConsequences(memberList)} This can&apos;t be undone.
              </p>
            </>
          }
          confirmLabel="Delete permanently"
          pendingLabel="Deleting…"
          pending={dialogPending}
          error={dialogError}
          onConfirm={() => void handleDelete()}
        />
      )}

      {permissions.canLeave && (
        <ConfirmDialog
          open={dialog === "leave"}
          onOpenChange={(open) => !open && setDialog(null)}
          title="Leave this game night?"
          description={
            <>
              <p>
                You&apos;ll be removed from <strong className="break-words">{gameNight.name}</strong> and it will
                disappear from your game nights. The host would need to invite you again.
              </p>
              {permissions.role === "accepted" && (
                <p>Games that only you own will be removed from its selected games.</p>
              )}
              <p>The game night itself won&apos;t be affected for anyone else.</p>
            </>
          }
          confirmLabel="Leave game night"
          pendingLabel="Leaving…"
          pending={dialogPending}
          error={dialogError}
          onConfirm={() => void handleLeave()}
        />
      )}

      {permissions.canInvite && memberList && (
        <InviteFriendsDialog
          open={dialog === "invite"}
          onOpenChange={(open) => !open && setDialog(null)}
          gameNightName={gameNight.name}
          existingMemberIds={memberIds(memberList)}
          onInvite={handleInvite}
        />
      )}
    </PageShell>
  );
}

function deleteConsequences(members: readonly GameNightMember[] | null): string {
  const guests = members ? members.length - 1 : null;
  const invitations =
    guests === null || guests < 0
      ? "all invitations and RSVPs"
      : guests === 0
        ? "its RSVP list"
        : `${guests} ${guests === 1 ? "guest's invitation" : "guests' invitations"} and RSVPs`;
  return `This also removes ${invitations}, the selected games and the game night's chat.`;
}

/* ------------------------------------------------------------ layout */

function PageShell({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-warm">
      <section className="bg-brand px-4 py-10 text-brand-foreground sm:py-12">
        <div className="mx-auto max-w-7xl sm:px-2">
          <Link
            href={ROUTES.gameNights}
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-white/90 hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Game Nights
          </Link>
          {title}
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
}

function LoadingPage() {
  return (
    <PageShell
      title={
        <div className="mt-4" aria-hidden="true">
          <div className="h-10 w-2/3 max-w-md animate-pulse rounded-lg bg-white/20" />
          <div className="mt-3 h-5 w-1/2 max-w-xs animate-pulse rounded bg-white/20" />
        </div>
      }
    >
      <h1 className="sr-only">Game night</h1>
      <p role="status" className="sr-only">
        Loading game night…
      </p>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <Card className="h-64 animate-pulse rounded-2xl bg-white" />
        <Card className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    </PageShell>
  );
}

function NotFoundPage({
  title = "Game night not found",
  message = "This game night doesn't exist, was deleted, or you aren't invited to it.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <PageShell title={<h1 className="mt-4 font-heading text-4xl font-bold">{title}</h1>}>
      <div className="flex flex-col items-center rounded-2xl border bg-white px-6 py-12 text-center">
        <p role="alert" className="max-w-md text-lg text-foreground/80">
          {message}
        </p>
        <Link href={ROUTES.gameNights} className={cn(buttonVariants(), PRIMARY_LINK_CLASSES, "mt-6")}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Game Nights
        </Link>
      </div>
    </PageShell>
  );
}

function Notices({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  // Both live regions stay mounted so screen readers reliably announce new messages.
  const content = (tone: Notice["tone"]) =>
    notice?.tone === tone && (
      <div
        className={cn(
          "mb-6 flex items-start justify-between gap-3 rounded-xl px-4 py-3 font-medium",
          tone === "success" ? "bg-brand-soft text-brand-strong" : "bg-destructive/10 text-destructive",
        )}
      >
        <p className="flex min-w-0 items-start gap-2">
          {tone === "success" && <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 break-words">{notice.message}</span>
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );

  return (
    <>
      <div role="status">{content("success")}</div>
      <div role="alert">{content("error")}</div>
    </>
  );
}

/* ------------------------------------------------------------ sections */

function InfoItem({ icon: Icon, label, children, className }: { icon: LucideIcon; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      <Icon className="mt-0.5 size-5 shrink-0 text-cta" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words">{children}</dd>
      </div>
    </div>
  );
}

function EventInfo({
  gameNight,
  hostName,
  past,
  editButton,
}: {
  gameNight: GameNightResponse;
  hostName: string | null;
  past: boolean;
  editButton: ReactNode;
}) {
  const start = new Date(gameNight.starts_at);
  return (
    <section aria-labelledby="details-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="details-heading" className="font-heading text-2xl font-bold">
          Details
        </h2>
        {editButton}
      </div>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        <InfoItem icon={CalendarDays} label="Date & time">
          <time dateTime={gameNight.starts_at}>
            {longDateFormat.format(start)}
            <br />
            {timeFormat.format(start)}
          </time>
          {past && <span className="mt-1 block text-sm text-muted-foreground">This game night has already started.</span>}
        </InfoItem>
        <InfoItem icon={MapPin} label="Location">
          {gameNight.location}
        </InfoItem>
        <InfoItem icon={UserRound} label="Host">
          {hostName ?? <span className="text-muted-foreground">Unavailable</span>}
        </InfoItem>
        <InfoItem icon={NotebookPen} label="Notes" className="sm:col-span-2">
          {gameNight.notes?.trim() ? (
            <span className="whitespace-pre-line">{gameNight.notes}</span>
          ) : (
            <span className="text-muted-foreground">No notes.</span>
          )}
        </InfoItem>
      </dl>
    </section>
  );
}

function YourStatusCard({
  gameNight,
  permissions,
  members,
  past,
  rsvpPending,
  rsvpError,
  onRespond,
  onRetryMembers,
  onLeave,
  onDelete,
}: {
  gameNight: GameNightResponse;
  permissions: DetailsPermissions;
  members: "loading" | "error" | "success";
  past: boolean;
  rsvpPending: RsvpAnswer | undefined;
  rsvpError: string | null;
  onRespond: (answer: RsvpAnswer) => void;
  onRetryMembers: () => void;
  onLeave: () => void;
  onDelete: () => void;
}) {
  const { role } = permissions;
  // Keep the button being saved visible even if a refresh changed the offered answers meanwhile.
  const answers =
    permissions.rsvpAnswers.length > 0 ? permissions.rsvpAnswers : rsvpPending ? [rsvpPending] : [];

  let heading: string;
  let text: string;
  if (permissions.isHost) {
    heading = "You're hosting";
    text = past ? "You hosted this game night." : "You can edit the details, pick games and invite friends.";
  } else if (role === "accepted") {
    heading = past ? "You attended" : "You're going";
    text = past ? "This game night has already started." : "See you there!";
  } else if (role === "pending") {
    heading = "You're invited";
    text = past ? "This game night started before you replied." : "Let the host know whether you can make it.";
  } else if (role === "declined") {
    heading = "You declined";
    text = past ? "You didn't attend this game night." : "You can still change your mind.";
  } else {
    heading = "Your RSVP";
    text = members === "loading" ? "Loading your RSVP status…" : "Couldn't load your RSVP status.";
  }

  return (
    <Card className="gap-0 rounded-2xl p-6 text-base">
      <section aria-labelledby="your-status-heading">
        <h2 id="your-status-heading" className="flex items-center gap-2 font-heading text-xl font-bold">
          {permissions.isHost && <Crown className="size-5 text-cta" aria-hidden="true" />}
          {heading}
        </h2>
        <p className="mt-1 text-muted-foreground" role={role === "unknown" && members === "loading" ? "status" : undefined}>
          {text}
        </p>
        {role === "unknown" && members === "error" && (
          <div className="mt-2">
            <RetryButton onClick={onRetryMembers} label="loading your RSVP status" />
          </div>
        )}

        {answers.length > 0 && (
          <div className="mt-5">
            <RsvpActions gameNightName={gameNight.name} answers={answers} pending={rsvpPending} onRespond={onRespond} />
          </div>
        )}

        {rsvpError && (
          <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {rsvpError}
          </p>
        )}

        {permissions.canLeave && (
          <button
            type="button"
            onClick={onLeave}
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 font-semibold text-destructive hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/30 focus-visible:outline-none"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Leave game night
          </button>
        )}

        {permissions.canDelete && (
          <div className="mt-6 border-t pt-5">
            <h3 className="font-semibold">Delete game night</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently removes it for everyone. There&apos;s no undo.
            </p>
            <button
              type="button"
              onClick={onDelete}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-destructive bg-white px-4 font-semibold text-destructive hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/30 focus-visible:outline-none"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete game night
            </button>
          </div>
        )}
      </section>
    </Card>
  );
}

export default GameNightDetails;
