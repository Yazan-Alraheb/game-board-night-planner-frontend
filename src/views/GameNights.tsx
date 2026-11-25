"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { CalendarHeart, CircleCheck, RotateCcw, X } from "lucide-react";
import OverviewGameNightCard from "@/components/game-nights/OverviewGameNightCard";
import Toast from "@/components/game-nights/Toast";
import {
  CreateGameNightLink,
  EmptyState,
  LoadErrorState,
  OverviewSkeleton,
} from "@/components/game-nights/OverviewStates";
import type { ApiErrorInfo } from "@/api/errors";
import { useGameNightsOverview, type RsvpAnswer } from "@/hooks/useGameNightsOverview";
import { consumeOverviewFlash } from "@/lib/game-nights/flash";
import { groupGameNights, type OverviewEntry, type OverviewTab } from "@/lib/game-nights/overview";
import { cn } from "@/lib/utils";

const TABS: { value: OverviewTab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "invitations", label: "Invitations" },
  { value: "past", label: "Past" },
  { value: "declined", label: "Declined" },
];

/** Re-check every minute so nights move to Past once they start. */
const NOW_REFRESH_MS = 60_000;

interface Notice {
  tone: "success" | "error";
  message: string;
}

function listErrorMessage(error: ApiErrorInfo): string {
  if (error.kind === "unauthorized") return "Your session has expired. Please log in again.";
  if (error.kind === "network") {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return "We couldn't load your game nights. Please try again.";
}

function GameNights() {
  const { userId, list, entries, pendingRsvp, rsvpErrors, reload, retryMembers, respond } =
    useGameNightsOverview();
  const [tab, setTab] = useState<OverviewTab>("upcoming");
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<Notice | null>(null);
  // Confirmation after deleting or leaving a night on its details page.
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), NOW_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  // A message left by the details page after the user deleted or left a night.
  // Read after the first paint (and only if not cancelled), so it's consumed exactly once.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const flash = consumeOverviewFlash();
      if (flash) setToast(flash);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const groups = useMemo(
    () => (entries && userId !== null ? groupGameNights(entries, userId, now) : null),
    [entries, userId, now],
  );
  const failedMembers = entries?.filter((entry) => entry.members.status === "error") ?? [];

  async function handleRespond(entry: OverviewEntry, answer: RsvpAnswer) {
    setNotice(null);
    const result = await respond(entry.gameNight, answer);
    if (!result) return;

    if (result.ok) {
      const name = result.gameNight.name;
      setNotice({
        tone: "success",
        message:
          result.status === "accepted"
            ? `You're going to ${name}! You'll find it under Upcoming.`
            : result.status === "declined"
              ? `You declined ${name}. You'll find it under Declined.`
              : `Your response to ${name} was saved.`,
      });
    } else if (result.removed) {
      // The card may disappear after the refresh, so repeat its error at the top.
      setNotice({ tone: "error", message: result.message });
    } else {
      return;
    }
    // The answered card leaves this tab; keep keyboard focus somewhere sensible.
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  function renderPanel(value: OverviewTab) {
    if (list.status === "loading") return <OverviewSkeleton />;
    if (list.status === "error") {
      return <LoadErrorState message={listErrorMessage(list.error)} onRetry={reload} />;
    }
    if (!groups || userId === null) return null;

    const items = groups[value];
    if (items.length === 0) return <TabEmptyState tab={value} invitationCount={groups.invitations.length} onShowInvitations={() => setTab("invitations")} />;

    return (
      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((entry) => (
          <li key={entry.gameNight.id} className="min-w-0">
            <OverviewGameNightCard
              entry={entry}
              userId={userId}
              now={now}
              pendingRsvp={pendingRsvp[entry.gameNight.id]}
              rsvpError={rsvpErrors[entry.gameNight.id]}
              onRespond={(answer) => void handleRespond(entry, answer)}
              onRetryMembers={() => void retryMembers(entry.gameNight.id)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="min-h-screen bg-surface-warm">
      <Toast message={toast} onDismiss={dismissToast} />
      <section className="bg-brand px-4 py-12 text-brand-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <CalendarHeart className="size-9 shrink-0" aria-hidden="true" />
              <h1 className="font-heading text-4xl font-bold">My Game Nights</h1>
            </div>
            <p className="mt-3 text-lg text-white/90">Manage your upcoming events and invitations.</p>
          </div>
          <CreateGameNightLink className="self-start bg-white text-brand-strong hover:bg-brand-soft sm:self-auto" />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {notice && (
          <div
            ref={noticeRef}
            tabIndex={-1}
            role={notice.tone === "error" ? "alert" : "status"}
            className={cn(
              "mb-6 flex items-start justify-between gap-3 rounded-xl px-4 py-3 font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              notice.tone === "success"
                ? "bg-brand-soft text-brand-strong"
                : "bg-destructive/10 text-destructive",
            )}
          >
            <p className="flex min-w-0 items-start gap-2">
              {notice.tone === "success" && <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 break-words">{notice.message}</span>
            </p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {failedMembers.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
            <p>
              We couldn&apos;t load details for {failedMembers.length}{" "}
              {failedMembers.length === 1 ? "game night" : "game nights"}. Their RSVP status and
              attendees may be missing.
            </p>
            <button
              type="button"
              onClick={() => failedMembers.forEach((entry) => void retryMembers(entry.gameNight.id))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-semibold hover:bg-amber-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Retry all
            </button>
          </div>
        )}

        <Tabs.Root value={tab} onValueChange={(value) => setTab(value as OverviewTab)}>
          <Tabs.List
            aria-label="Game night categories"
            className="mb-8 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-foreground/10 sm:inline-grid sm:grid-cols-4"
          >
            {TABS.map(({ value, label }) => {
              const count = groups?.[value].length;
              return (
                <Tabs.Tab
                  key={value}
                  value={value}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-active:bg-brand-strong data-active:font-semibold data-active:text-brand-foreground"
                >
                  {label}
                  {count !== undefined && (
                    <span
                      className={cn(
                        "min-w-6 rounded-full px-1.5 text-sm tabular-nums",
                        value === "invitations" && count > 0
                          ? "bg-amber-200 text-amber-950"
                          : "bg-black/10",
                      )}
                    >
                      {count}
                      <span className="sr-only">{count === 1 ? " game night" : " game nights"}</span>
                    </span>
                  )}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>

          {TABS.map(({ value, label }) => (
            <Tabs.Panel
              key={value}
              value={value}
              className="rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <h2 className="sr-only">{label}</h2>
              {renderPanel(value)}
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      </div>
    </div>
  );
}

function TabEmptyState({
  tab,
  invitationCount,
  onShowInvitations,
}: {
  tab: OverviewTab;
  invitationCount: number;
  onShowInvitations: () => void;
}) {
  switch (tab) {
    case "upcoming":
      return (
        <EmptyState
          title="No upcoming game nights yet."
          description="Plan a night with your friends, or accept an invitation to see it here."
          action={
            <>
              <CreateGameNightLink />
              {invitationCount > 0 && (
                <button
                  type="button"
                  onClick={onShowInvitations}
                  className="inline-flex h-11 items-center rounded-xl border border-brand-strong px-5 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  View {invitationCount} {invitationCount === 1 ? "invitation" : "invitations"}
                </button>
              )}
            </>
          }
        />
      );
    case "invitations":
      return <EmptyState title="You don't have any pending invitations." />;
    case "past":
      return (
        <EmptyState
          title="No past game nights yet."
          description="Game nights you've hosted or attended will show up here afterwards."
        />
      );
    case "declined":
      return <EmptyState title="You haven't declined any invitations." />;
  }
}

export default GameNights;
