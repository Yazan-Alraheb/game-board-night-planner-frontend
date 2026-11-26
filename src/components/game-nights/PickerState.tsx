import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { UserResource } from "@/hooks/useUserResource";

const BOX = "rounded-2xl border-2 border-dashed p-6 text-center text-sm";

interface PickerStateProps<T> {
  resource: UserResource<readonly T[]>;
  /** e.g. "your games" → "Loading your games…" / "Couldn't load your games." */
  noun: string;
  onRetry: () => void;
  /** Shown when the list loaded and is empty. */
  empty: ReactNode;
  children: (items: readonly T[]) => ReactNode;
}

/**
 * Loading, error (with Try again), empty and loaded states for a list the user picks from.
 * A failed request is never shown as an empty list.
 */
function PickerState<T>({ resource, noun, onRetry, empty, children }: PickerStateProps<T>) {
  if (resource.status === "loading" || resource.status === "signed-out") {
    return (
      <p role="status" className={`${BOX} text-muted-foreground`}>
        Loading {noun}…
      </p>
    );
  }

  if (resource.status === "error") {
    return (
      <div role="alert" className={`${BOX} flex flex-col items-center gap-3 border-destructive/40`}>
        <p className="text-destructive">Couldn&apos;t load {noun}.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="rounded-lg">
          Try again
        </Button>
      </div>
    );
  }

  if (resource.data.length === 0) {
    return <div className={`${BOX} text-muted-foreground`}>{empty}</div>;
  }

  return <>{children(resource.data)}</>;
}

export default PickerState;
