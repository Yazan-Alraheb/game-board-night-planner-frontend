import { createContext } from "react";
import type { AuthResponse } from "@/api/auth";

export interface AuthContextValue {
  session: AuthResponse | null;
  signIn: (data: AuthResponse) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
