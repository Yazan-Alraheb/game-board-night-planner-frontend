"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorInfo, type ApiErrorInfo } from "@/api/errors";

export type LazyResource<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiErrorInfo };

/**
 * Loads data the first time `enabled` becomes true, then keeps it,
 * so moving between steps doesn't refetch.
 *
 * `fetcher` must be a stable function, such as a module-level API function.
 * Pending requests are aborted on unmount. `retry()` loads the data again.
 */
export function useLazyResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
): [LazyResource<T>, () => void] {
  const [resource, setResource] = useState<LazyResource<T>>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  // The attempt that finished successfully, so a successful load isn't repeated.
  const loadedAttempt = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || loadedAttempt.current === attempt) return;

    const controller = new AbortController();
    setResource({ status: "loading" });

    fetcher(controller.signal)
      .then((data) => {
        loadedAttempt.current = attempt;
        setResource({ status: "success", data });
      })
      .catch((error: unknown) => {
        const info = getApiErrorInfo(error);
        if (info.kind === "canceled" || controller.signal.aborted) return;
        setResource({ status: "error", error: info });
      });

    return () => controller.abort();
  }, [fetcher, enabled, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return [resource, retry];
}
