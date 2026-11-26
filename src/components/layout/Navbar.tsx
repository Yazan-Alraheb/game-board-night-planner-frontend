"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dices, Menu, Plus, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/auth/useAuth";


interface NavItem {
  label: string;
  to: string;
  /** Other routes that belong to this item, e.g. the quiz results page. */
  related?: readonly string[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", to: ROUTES.home },
  { label: "Find a Game", to: ROUTES.findGame, related: [ROUTES.recommendations] },
  // Nested routes (/game-nights/new, /game-nights/42) also highlight this via matchesRoute.
  { label: "Game Nights", to: ROUTES.gameNights },
  { label: "Browse", to: ROUTES.browse },
  { label: "My Collection", to: ROUTES.collection },
  { label: "Friends", to: ROUTES.friends },
  { label: "Messages", to: ROUTES.messages },
];

const MOBILE_MENU_ID = "mobile-navigation";

/** Exact match or a nested route ("/friends/42" belongs to "/friends"). Home only matches "/". */
function matchesRoute(pathname: string, route: string): boolean {
  if (route === ROUTES.home) return pathname === ROUTES.home;
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isNavItemActive(item: NavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  return [item.to, ...(item.related ?? [])].some((route) => matchesRoute(pathname, route));
}

function navLinkClass(isActive: boolean) {
  return cn(
    "rounded-lg px-4 py-2 text-base font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
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

        <nav aria-label="Main" className="mx-auto hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item, pathname);
              return (
                <li key={item.to}>
                  <Link
                    href={item.to}
                    aria-current={active ? "page" : undefined}
                    // Tighter than the mobile menu so all items and the username fit beside
                    // the actions (the header content is capped at max-w-7xl).
                    className={cn(navLinkClass(active), "px-2")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-3 xl:ml-0 xl:gap-2">
          <Link
            href={ROUTES.createGameNight}
            className={cn(
              buttonVariants(),
              "hidden h-11 shrink-0 rounded-xl bg-brand-strong px-5 text-base font-semibold whitespace-nowrap text-brand-foreground hover:bg-brand sm:inline-flex"
            )}
          >
            Create Game Night
          </Link>

          {session ? (
            <div className="hidden min-w-0 items-center gap-2 xl:flex">
              <Link
                href={ROUTES.profile}
                title="View your profile"
                aria-current={pathname === ROUTES.profile ? "page" : undefined}
                className="block max-w-32 truncate rounded-md font-semibold text-brand-strong hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {session.user.name}
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 shrink-0 rounded-xl px-4 whitespace-nowrap"
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
                "h-10 shrink-0 rounded-xl border-brand-strong px-5 font-semibold whitespace-nowrap text-brand-strong hover:bg-brand-soft"
              )}
            >
              Log In
            </Link>
          )}

          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-lg" }),
              "shrink-0 xl:hidden"
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
          className="border-t bg-white xl:hidden"
        >
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item, pathname);
              return (
                <li key={item.to}>
                  <Link
                    href={item.to}
                    onClick={closeMenu}
                    aria-current={active ? "page" : undefined}
                    className={cn(navLinkClass(active), "block")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}

            {session && (
              <>
                <li>
                  <Link
                    href={ROUTES.profile}
                    onClick={closeMenu}
                    aria-current={pathname === ROUTES.profile ? "page" : undefined}
                    className={cn(
                      navLinkClass(pathname === ROUTES.profile),
                      "block truncate"
                    )}
                  >
                    Profile ({session.user.name})
                  </Link>
                </li>

                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-lg px-4 py-2 text-left font-medium text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
