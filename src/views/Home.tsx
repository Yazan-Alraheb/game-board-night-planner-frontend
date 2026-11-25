import HeroSection from "@/components/home/HeroSection";
import UpcomingGameNightsSection from "@/components/home/UpcomingGameNightsSection";
import DiscoverGamesSection from "@/components/home/DiscoverGamesSection";

function Home() {
  return (
    <div className="bg-surface-warm">
      <HeroSection />

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <UpcomingGameNightsSection />
        <DiscoverGamesSection />
      </div>
    </div>
  );
}

export default Home;
