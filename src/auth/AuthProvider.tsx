import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "@/auth/context";
import {
  saveSession,
  getSession,
  clearSession,
  getTokenExpirationMs,
  AUTH_INVALIDATED_EVENT,
} from "@/auth/session";
import type { AuthResponse } from "@/api/auth";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthResponse | null>(
    () => getSession()
  );

  function signIn(data: AuthResponse) {
    saveSession(data);
    setSession(data);
  }

  function signOut() {
    clearSession();
    setSession(null);
  }

  // Automatically log out when the JWT expires
  useEffect(() => {
    if (!session) return;

    const expiresAt = getTokenExpirationMs(session.access_token);
    const delay = Math.max(0, (expiresAt ?? 0) - Date.now());

    const timer = window.setTimeout(() => {
      clearSession();
      setSession(null);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [session]);

  // Keep React in sync when the server rejects a token
  useEffect(() => {
    const syncSession = () => {
      setSession(getSession());
    };

    window.addEventListener(AUTH_INVALIDATED_EVENT, syncSession);
    window.addEventListener("focus", syncSession);

    return () => {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, syncSession);
      window.removeEventListener("focus", syncSession);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
