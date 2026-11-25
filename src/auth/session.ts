import type { AuthResponse } from "@/api/auth";

const SESSION_KEY = "gamenight_session";

export const AUTH_INVALIDATED_EVENT = "gamenight:auth-invalidated";

// Read the expiration timestamp from the JWT
export function getTokenExpirationMs(token: string): number | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: unknown };

    if (
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= 0
    ) {
      return null;
    }

    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthResponse): void {
  const expiresAt = getTokenExpirationMs(session.access_token);

  if (expiresAt === null || expiresAt <= Date.now()) {
    throw new Error("Received an invalid or expired token.");
  }

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): AuthResponse | null {
  const stored = sessionStorage.getItem(SESSION_KEY);

  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as AuthResponse;
    const expiresAt = getTokenExpirationMs(session?.access_token);

    if (
      !session?.user ||
      typeof session.user.username !== "string" ||
      !session.access_token ||
      expiresAt === null ||
      expiresAt <= Date.now()
    ) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
