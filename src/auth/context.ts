"use client";

import { createContext } from "react";
import type { AuthResponse } from "@/api/auth";

export interface AuthContextValue {
  session: AuthResponse | null;
  ready: boolean;
  signIn: (data: AuthResponse) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
