import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { Dices, Menu, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { UserSummary } from "@/types/game";

const NAV_ITEMS = [
  { label: "Home", to: ROUTES.home },
  { label: "Find a Game", to: ROUTES.findGame },
  { label: "Browse", to: ROUTES.browse },
  { label: "My Collection", to: ROUTES.collection },
  { label: "Messages", to: ROUTES.messages },
] as const;

const MOBILE_MENU_ID = "mobile-navigation";

interface NavbarProps {
  currentUser: UserSummary;
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-lg px-4 py-2 text-base font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    isActive
      ? "bg-brand-soft text-brand-strong"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function Navbar({ currentUser }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

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
          to={ROUTES.home}
          onClick={closeMenu}
          className="flex items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Dices className="size-5" aria-hidden="true" />
          </span>
          <span className="font-heading text-xl font-bold tracking-tight">GameNight</span>
        </Link>

        <nav aria-label="Main" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end className={navLinkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <Link
            to={ROUTES.createGameNight}
            className={cn(
              buttonVariants(),
              "hidden h-11 rounded-xl bg-brand-strong px-5 text-base font-semibold text-brand-foreground hover:bg-brand sm:inline-flex",
            )}
          >
            Create Game Night
          </Link>

          {/* No auth yet: the avatar shows the mock user and links to the existing Dashboard. */}
          <Link
            to={ROUTES.dashboard}
            onClick={closeMenu}
            aria-label={`${currentUser.display_name}: open your dashboard`}
            className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Avatar size="lg">
              {currentUser.avatar_url && (
                <AvatarImage src={currentUser.avatar_url} alt="" />
              )}
              <AvatarFallback className="bg-brand-soft font-semibold text-brand-strong">
                {getInitials(currentUser.display_name)}
              </AvatarFallback>
            </Avatar>
          </Link>

          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "lg:hidden")}
            aria-expanded={menuOpen}
            aria-controls={MOBILE_MENU_ID}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id={MOBILE_MENU_ID} aria-label="Main" className="border-t bg-white lg:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end onClick={closeMenu} className={(state) => cn(navLinkClass(state), "block")}>
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <Link
                to={ROUTES.createGameNight}
                onClick={closeMenu}
                className={cn(
                  buttonVariants(),
                  "h-11 w-full rounded-xl bg-brand-strong text-base font-semibold text-brand-foreground hover:bg-brand",
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
