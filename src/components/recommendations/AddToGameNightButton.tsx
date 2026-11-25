import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AddGameStatus } from "@/hooks/useAddToGameNight";

interface AddToGameNightButtonProps {
  gameName: string;
  status: AddGameStatus;
  /** Extra page-level block, e.g. after an event-wide denial. */
  disabled: boolean;
  onAdd: () => void;
}

/** Adds one recommended game to the selected game night and announces the outcome. */
function AddToGameNightButton({ gameName, status, disabled, onAdd }: AddToGameNightButtonProps) {
  const done = status.state === "added" || status.state === "already";
  const busy = status.state === "adding" || status.state === "checking";
  const blocked =
    disabled ||
    done ||
    busy ||
    status.state === "unavailable" ||
    (status.state === "error" && !status.retryable);

  let label = "Add to game night";
  if (status.state === "checking") label = "Checking game night…";
  else if (status.state === "adding") label = "Adding…";
  else if (status.state === "added") label = "Added to game night";
  else if (status.state === "already") label = "In this game night";

  let accessibleName = `Add ${gameName} to game night`;
  if (done) accessibleName = `${gameName} is in this game night`;
  else if (status.state === "checking") accessibleName = `Checking whether ${gameName} is already in this game night`;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant={done ? "outline" : "default"}
        onClick={onAdd}
        disabled={blocked}
        aria-label={accessibleName}
        className={
          done
            ? "h-11 w-full rounded-xl border-brand-strong/40 bg-brand-soft text-base text-brand-strong disabled:opacity-100"
            : "h-11 w-full rounded-xl bg-brand-strong text-base font-semibold text-brand-foreground hover:bg-brand"
        }
      >
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : done ? (
          <Check aria-hidden="true" />
        ) : (
          <CalendarPlus aria-hidden="true" />
        )}
        {label}
      </Button>

      {/* Announces the result of an add (success or this game's error). */}
      <p role="status" className="text-sm empty:hidden">
        {status.state === "added" && <span className="text-brand-strong">Added {gameName} to the game night.</span>}
        {status.state === "error" && <span className="text-destructive">{status.message}</span>}
      </p>
    </div>
  );
}

export default AddToGameNightButton;
