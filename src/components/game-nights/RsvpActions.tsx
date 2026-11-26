import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RsvpAnswer } from "@/hooks/useGameNightsOverview";

interface RsvpActionsProps {
  gameNightName: string;
  /**
   * The answers to offer. Both means an unanswered invitation; only "accepted" means the
   * user declined before; only "declined" means they accepted before.
   */
  answers: readonly RsvpAnswer[];
  /** The answer being saved, if any. All buttons are disabled meanwhile. */
  pending: RsvpAnswer | undefined;
  onRespond: (answer: RsvpAnswer) => void;
}

/** Accept / Decline for the user's own invitation, or switching an earlier answer. */
function RsvpActions({ gameNightName, answers, pending, onRespond }: RsvpActionsProps) {
  const busy = pending !== undefined;
  // A single answer means the user is changing a response they already gave.
  const changingMind = answers.length === 1;
  const hint = !changingMind
    ? null
    : answers[0] === "accepted"
      ? "Changed your mind?"
      : "Can't make it anymore?";

  return (
    <div role="group" aria-label={`Respond to ${gameNightName}`} aria-busy={busy}>
      {hint && <p className="mb-3 text-sm text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-3">
        {answers.includes("accepted") && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => onRespond("accepted")}
            aria-label={`Accept invitation to ${gameNightName}`}
            className="h-11 min-w-28 flex-1 rounded-xl bg-brand-strong px-5 text-base font-semibold text-brand-foreground hover:bg-brand"
          >
            {pending === "accepted" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {pending === "accepted" ? "Accepting…" : changingMind ? "Accept instead" : "Accept"}
          </Button>
        )}
        {answers.includes("declined") && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => onRespond("declined")}
            aria-label={`Decline invitation to ${gameNightName}`}
            // Same pink as the site's other call-to-action buttons (e.g. "Find a Game").
            className="h-11 min-w-28 flex-1 rounded-xl bg-cta px-5 text-base font-semibold text-cta-foreground hover:bg-cta/90 focus-visible:ring-cta/40"
          >
            {pending === "declined" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <X className="size-4" aria-hidden="true" />
            )}
            {pending === "declined" ? "Declining…" : changingMind ? "Decline instead" : "Decline"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default RsvpActions;
