"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiErrorInfo } from "@/api/errors";
import { useAuth } from "@/auth/useAuth";
import {
  resolveUserResource,
  userRequestKey,
  type KeyedResult,
  type UserResource,
} from "@/lib/user-resource";

export type { UserResource };

/**
 * Loads data for the signed-in user and reloads it when the user or session changes.
 *
 * - `fetcher` must be stable (a module-level function), like useLazyResource.
 * - Requests are aborted on unmount, sign-out, session change and retry, and a result
 *   is only shown for the session that requested it, so stale data never leaks across users.
 * - Signed-out visitors get `{ status: "signed-out" }` and no request is made.
 * - A 401 is handled by the shared Axios client, which clears the session; this hook then
 *   reports "signed-out".
 */
export function useUserResource<T>(
  fetcher: (userId: number, signal: AbortSignal) => Promise<T>,
): [UserResource<T>, () => void] {
  const { session, ready } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<KeyedResult<T> | null>(null);

  const userId = session?.user.id ?? null;
  const token = session?.access_token ?? null;
  const requestKey = userRequestKey(userId, token, attempt);

  useEffect(() => {
    if (requestKey === null || userId === null) return;

    const controller = new AbortController();

    fetcher(userId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, value: { status: "success", data } });
        }
      })
      .catch((error: unknown) => {
        const info = getApiErrorInfo(error);
        if (info.kind === "canceled" || controller.signal.aborted) return;
        setResult({ key: requestKey, value: { status: "error", error: info } });
      });

    return () => controller.abort();
  }, [fetcher, requestKey, userId]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return [resolveUserResource(ready, requestKey, result), retry];
}
