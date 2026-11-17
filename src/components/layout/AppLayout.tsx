
import { Outlet } from "react-router";
import Navbar from "@/components/layout/Navbar";

function AppLayout() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>

      <Navbar />

      <main id="main-content">
        <Outlet />
      </main>
    </>
  );
}

export default AppLayout;
