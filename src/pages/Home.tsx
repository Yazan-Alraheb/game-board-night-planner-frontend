import { Plus } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import SectionHeader from "@/components/home/SectionHeader";
import GameNightCard from "@/components/home/GameNightCard";
import DiscoverGamesSection from "@/components/home/DiscoverGamesSection";
import { ROUTES } from "@/lib/routes";
// TODO(api): replace this mock data with GET /api/game-nights once the
// GameNight type is aligned with the backend (see src/types/game.ts).
import { mockUpcomingGameNights } from "@/mocks/homepage";

function Home() {
  const upcomingGameNights = mockUpcomingGameNights;

  return (
    <div className="bg-surface-warm">
      <HeroSection />

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section aria-labelledby="upcoming-heading">
          <SectionHeader
            id="upcoming-heading"
            title="Upcoming Game Nights"
            action={{
              to: ROUTES.createGameNight,
              label: (
                <>
                  <Plus className="size-4" aria-hidden="true" />
                  Create New
                </>
              ),
            }}
          />
          {upcomingGameNights.length > 0 ? (
            <ul className="grid gap-6 md:grid-cols-2">
              {upcomingGameNights.map((gameNight) => (
                <li key={gameNight.id} className="grid">
                  <GameNightCard gameNight={gameNight} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No upcoming game nights yet.</p>
          )}
        </section>

        <DiscoverGamesSection />
      </div>
    </div>
  );
}

export default Home;
