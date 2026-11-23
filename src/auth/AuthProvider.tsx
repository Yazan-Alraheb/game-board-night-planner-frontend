"use client";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [ready, setReady] = useState(false);

  function signIn(data: AuthResponse) {
    saveSession(data);
    setSession(data);
    setReady(true);
  }

  function signOut() {
    clearSession();
    setSession(null);
    setReady(true);
  }

  useEffect(() => {
    const syncSession = () => {
      setSession(getSession());
      setReady(true);
    };
    syncSession();
    window.addEventListener(AUTH_INVALIDATED_EVENT, syncSession);
    window.addEventListener("focus", syncSession);
    return () => {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, syncSession);
      window.removeEventListener("focus", syncSession);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const expiry = getTokenExpirationMs(session.access_token);
    const delay = Math.max(0, (expiry ?? 0) - Date.now());
    const timer = window.setTimeout(() => {
      setSession(getSession());
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
