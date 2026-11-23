import type { ReactNode } from "react";
import ProtectedRoute from "@/auth/ProtectedRoute";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
