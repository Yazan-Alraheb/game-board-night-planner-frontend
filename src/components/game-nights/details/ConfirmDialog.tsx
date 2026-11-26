"use client";

import { useRef, type ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}

/**
 * Confirmation for a destructive action. Focus starts on Cancel, so pressing Enter right away
 * never confirms. Escape, the backdrop and Cancel all close it, except while the request runs.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup
          initialFocus={cancelRef}
          aria-busy={pending}
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none sm:p-7"
        >
          <AlertDialog.Title className="font-heading text-xl font-bold break-words">{title}</AlertDialog.Title>
          <AlertDialog.Description render={<div />} className="mt-3 space-y-2 text-foreground/80">
            {description}
          </AlertDialog.Description>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Close
              ref={cancelRef}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-brand-strong px-5 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            >
              Cancel
            </AlertDialog.Close>
            <Button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className="h-11 rounded-xl bg-destructive px-5 text-base font-semibold text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export default ConfirmDialog;
