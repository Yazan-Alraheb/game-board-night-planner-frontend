"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/auth/useAuth";
import { ROUTES } from "@/lib/routes";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(pathname ?? ROUTES.home)}`);
    }
  }, [ready, session, pathname, router]);

  if (!ready || !session) {
    return <p role="status" className="p-8 text-muted-foreground">Checking login...</p>;
  }
  return <>{children}</>;
}
