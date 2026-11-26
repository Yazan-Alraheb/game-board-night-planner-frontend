"use client";

import { useEffect, useState } from "react";
import { CircleCheck, X } from "lucide-react";

/** How long the toast stays up. Hovering or focusing it pauses the countdown. */
const TOAST_DURATION_MS = 6000;

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

/**
 * Success toast in the bottom-right corner, styled like the "Game night created!" message
 * on the Create Game Night page. The live region is always mounted, so screen readers
 * announce the message without moving focus.
 */
function Toast({ message, onDismiss }: ToastProps) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!message || paused) return;
    const timer = window.setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [message, paused, onDismiss]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6">
      {message && (
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pointer-events-auto flex w-full max-w-sm animate-in items-start gap-3 rounded-xl bg-brand-strong py-3 pr-2 pl-5 font-semibold text-white shadow-lg fade-in slide-in-from-bottom-4 motion-reduce:animate-none sm:w-auto"
        >
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 py-0.5 break-words">{message}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="-my-1 flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export default Toast;
