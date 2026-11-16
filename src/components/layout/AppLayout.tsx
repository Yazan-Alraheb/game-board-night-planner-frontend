import { Outlet } from "react-router";
import Navbar from "@/components/layout/Navbar";
// TODO(auth): replace the mock user with the logged-in user once authentication exists.
import { mockCurrentUser } from "@/mocks/homepage";

/** Shared shell for every page: skip link, navbar and the routed page content. */
function AppLayout() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>
      <Navbar currentUser={mockCurrentUser} />
      <main id="main-content">
        <Outlet />
      </main>
    </>
  );
}

export default AppLayout;
