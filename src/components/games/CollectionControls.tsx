import Link from "next/link";
import { BookmarkCheck, CheckCircle2, RotateCcw } from "lucide-react";
import type { GameCollectionView } from "@/hooks/useGameDetails";
import { describeCollectionLoadError } from "@/lib/games/game-details";
import type { CollectionAction } from "@/lib/games/collection-status";
import { ROUTES } from "@/lib/routes";
import type { CollectionStatus } from "@/types/collection";

const PRIMARY =
  "rounded-xl bg-brand-strong px-5 py-3 font-semibold text-white disabled:opacity-50";
const SECONDARY =
  "rounded-xl border border-brand-strong px-5 py-3 font-semibold text-brand-strong disabled:opacity-50";
const DANGER =
  "rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-600 disabled:opacity-50";

interface CollectionControlsProps {
  collection: GameCollectionView;
  onSave: (status: CollectionStatus) => void;
  onRemove: () => void;
  onRetry: () => void;
}

/** "Save this game" panel: shows the saved status and only the actions that make sense for it. */
export default function CollectionControls({
  collection,
  onSave,
  onRemove,
  onRetry,
}: CollectionControlsProps) {
  return (
    <section
      aria-labelledby="collection-heading"
      className="mt-8 rounded-2xl bg-white p-6"
    >
      <h2 id="collection-heading" className="text-2xl font-bold">
        Save this game
      </h2>
      <CollectionBody
        collection={collection}
        onSave={onSave}
        onRemove={onRemove}
        onRetry={onRetry}
      />
    </section>
  );
}

function CollectionBody({ collection, onSave, onRemove, onRetry }: CollectionControlsProps) {
  switch (collection.status) {
    case "signed-out":
      return (
        <p className="mt-3 text-muted-foreground">
          <Link href={ROUTES.login} className="font-semibold text-brand-strong underline">
            Log in
          </Link>{" "}
          to save this game to your collection or wishlist.
        </p>
      );

    case "loading":
      return (
        <p role="status" className="mt-3 text-muted-foreground">
          Checking your collection…
        </p>
      );

    case "error":
      return (
        <div className="mt-3">
          <p role="alert" className="text-destructive">
            {describeCollectionLoadError(collection.error)}
          </p>
          <button type="button" onClick={onRetry} className={`mt-4 inline-flex items-center gap-2 ${SECONDARY}`}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      );

    case "ready": {
      const { saved, pending, notice } = collection;
      const busy = pending !== null;
      const label = (action: CollectionAction, idle: string) =>
        pending === action ? (action === "remove" ? "Removing…" : "Saving…") : idle;

      return (
        <div className="mt-3" aria-busy={busy}>
          {saved === "owned" && (
            <p className="flex items-center gap-2 font-medium text-brand-strong">
              <CheckCircle2 className="size-5" aria-hidden="true" />
              Owned: this game is in your collection.
            </p>
          )}
          {saved === "wishlist" && (
            <p className="flex items-center gap-2 font-medium text-brand-strong">
              <BookmarkCheck className="size-5" aria-hidden="true" />
              Wishlist: this game is on your wishlist.
            </p>
          )}
          {saved === null && (
            <p className="text-muted-foreground">This game isn&apos;t in your collection yet.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {saved === null && (
              <>
                <button type="button" disabled={busy} onClick={() => onSave("owned")} className={PRIMARY}>
                  {label("add-owned", "Add to Collection")}
                </button>
                <button type="button" disabled={busy} onClick={() => onSave("wishlist")} className={SECONDARY}>
                  {label("add-wishlist", "Add to Wishlist")}
                </button>
              </>
            )}
            {saved === "owned" && (
              <button type="button" disabled={busy} onClick={() => onSave("wishlist")} className={SECONDARY}>
                {label("move-wishlist", "Move to Wishlist")}
              </button>
            )}
            {saved === "wishlist" && (
              <button type="button" disabled={busy} onClick={() => onSave("owned")} className={PRIMARY}>
                {label("move-owned", "Move to Collection")}
              </button>
            )}
            {saved !== null && (
              <button type="button" disabled={busy} onClick={onRemove} className={DANGER}>
                {label("remove", "Remove")}
              </button>
            )}
          </div>

          {pending === "refresh" && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Checking your collection…
            </p>
          )}
          {notice && pending === null && (
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={`mt-3 text-sm ${notice.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {notice.text}
            </p>
          )}
        </div>
      );
    }
  }
}
