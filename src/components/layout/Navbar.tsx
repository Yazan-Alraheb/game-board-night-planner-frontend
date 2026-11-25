"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dices, Menu, Plus, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/auth/useAuth";


const NAV_ITEMS = [
  { label: "Home", to: ROUTES.home },
  { label: "Find a Game", to: ROUTES.findGame },
  { label: "Browse", to: ROUTES.browse },
  { label: "My Collection", to: ROUTES.collection },
  { label: "Friends", to: ROUTES.friends },
  { label: "Messages", to: ROUTES.messages },
] as const;

/** Pages that belong to a nav item, so the item stays highlighted there too. */
const RELATED_PATHS: Partial<Record<string, readonly string[]>> = {
  // The recommendations page is the last step of Find a Game.
  [ROUTES.findGame]: [ROUTES.recommendations],
};

function isNavItemActive(pathname: string | null, to: string): boolean {
  if (pathname === null) return false;
  return pathname === to || (RELATED_PATHS[to]?.includes(pathname) ?? false);
}

const MOBILE_MENU_ID = "mobile-navigation";



function navLinkClass(isActive: boolean) {
  return cn(
    "rounded-lg px-4 py-2 text-base font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    isActive
      ? "bg-brand-soft text-brand-strong"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const closeMenu = () => setMenuOpen(false);

  const previousPage =
    !pathname ||
    pathname === ROUTES.login ||
    pathname === ROUTES.register
      ? ROUTES.home
      : pathname;

  const loginHref =
    `${ROUTES.login}?next=${encodeURIComponent(previousPage)}`;

  function handleLogout() {
    signOut();
    closeMenu();
    router.replace(ROUTES.login);
  }

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link
          href={ROUTES.home}
          onClick={closeMenu}
          className="flex items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Dices className="size-5" aria-hidden="true" />
          </span>

          <span className="font-heading text-xl font-bold tracking-tight">
            GameNight
          </span>
        </Link>

        <nav aria-label="Main" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  href={item.to}
                  aria-current={
                    isNavItemActive(pathname, item.to) ? "page" : undefined
                  }
                  className={navLinkClass(isNavItemActive(pathname, item.to))}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <Link
            href={ROUTES.createGameNight}
            className={cn(
              buttonVariants(),
              "hidden h-11 rounded-xl bg-brand-strong px-5 text-base font-semibold text-brand-foreground hover:bg-brand sm:inline-flex"
            )}
          >
            Create Game Night
          </Link>

          {session ? (
            <div className="hidden items-center gap-3 lg:flex">
              <Link
                href={ROUTES.dashboard}
                className="font-semibold text-brand-strong hover:underline"
              >
                {session.user.name}
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 rounded-xl px-4"
                )}
              >
                Log Out
              </button>
            </div>
          ) : (
            <Link
              href={loginHref}
              onClick={closeMenu}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 rounded-xl border-brand-strong px-5 font-semibold text-brand-strong hover:bg-brand-soft"
              )}
            >
              Log In
            </Link>
          )}

          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-lg" }),
              "lg:hidden"
            )}
            aria-expanded={menuOpen}
            aria-controls={MOBILE_MENU_ID}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X aria-hidden="true" />
            ) : (
              <Menu aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id={MOBILE_MENU_ID}
          aria-label="Main"
          className="border-t bg-white lg:hidden"
        >
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  href={item.to}
                  onClick={closeMenu}
                  aria-current={
                    isNavItemActive(pathname, item.to) ? "page" : undefined
                  }
                  className={cn(
                    navLinkClass(isNavItemActive(pathname, item.to)),
                    "block"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}

            {session && (
              <>
                <li>
                  <Link
                    href={ROUTES.dashboard}
                    onClick={closeMenu}
                    className={cn(
                      navLinkClass(pathname === ROUTES.dashboard),
                      "block"
                    )}
                  >
                    Dashboard ({session.user.name})
                  </Link>
                </li>

                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-lg px-4 py-2 text-left font-medium text-brand-strong hover:bg-brand-soft"
                  >
                    Log Out
                  </button>
                </li>
              </>
            )}

            <li className="pt-2 sm:hidden">
              <Link
                href={ROUTES.createGameNight}
                onClick={closeMenu}
                className={cn(
                  buttonVariants(),
                  "h-11 w-full rounded-xl bg-brand-strong text-base font-semibold text-brand-foreground hover:bg-brand"
                )}
              >
                <Plus aria-hidden="true" />
                Create Game Night
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

export default Navbar;
