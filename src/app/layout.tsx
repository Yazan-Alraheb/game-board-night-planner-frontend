import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "@/auth/AuthProvider";
import Navbar from "@/components/layout/Navbar";

import "../index.css";

// oxlint-disable-next-line react/only-export-components
export const metadata: Metadata = {
  title: "Game Night Planner",
  description: "Plan game nights and discover board games.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
          >
            Skip to main content
          </a>

          <Navbar />

          <main id="main-content">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
