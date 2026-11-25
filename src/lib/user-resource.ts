import type { ApiErrorInfo } from "@/api/errors";

export type UserResource<T> =
  | { status: "signed-out" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiErrorInfo };

/** A finished request's outcome, tagged with the request key it belongs to. */
export interface KeyedResult<T> {
  key: string;
  value: UserResource<T>;
}

/**
 * Identifies one request: a new user, a new token (re-login) or a retry gives a new key.
 * null when nobody is signed in.
 */
export function userRequestKey(
  userId: number | null,
  token: string | null,
  attempt: number,
): string | null {
  return userId !== null && token !== null ? `${userId}|${token}|${attempt}` : null;
}

/**
 * What to render. A result is only used when it belongs to the current request key,
 * so data loaded for a previous user, session or attempt is never shown.
 */
export function resolveUserResource<T>(
  ready: boolean,
  requestKey: string | null,
  result: KeyedResult<T> | null,
): UserResource<T> {
  if (!ready) return { status: "loading" };
  if (requestKey === null) return { status: "signed-out" };
  if (result?.key === requestKey) return result.value;
  return { status: "loading" };
}
