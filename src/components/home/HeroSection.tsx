import Link from "next/link";
import { ArrowRight, Dices, Puzzle, Trophy, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

interface HeroSectionProps {
  /** Hero photo. Until the Figma image is added to src/assets, a decorative placeholder is shown. */
  image?: { src: string; alt: string };
}

function HeroImagePlaceholder() {
  const icons = [Dices, Puzzle, Trophy, Users];
  return (
    <div
      aria-hidden="true"
      className="grid aspect-4/3 w-full grid-cols-2 gap-4 rounded-2xl bg-white/10 p-6 shadow-2xl ring-1 ring-white/20 sm:p-8"
    >
      {icons.map((Icon, index) => (
        <div key={index} className="flex items-center justify-center rounded-xl bg-white/10">
          <Icon className="size-12 text-brand-highlight sm:size-16" strokeWidth={1.5} />
        </div>
      ))}
    </div>
  );
}

function HeroSection({ image }: HeroSectionProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="bg-linear-to-br from-brand to-brand-gradient-end text-brand-foreground"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium sm:text-base">
            <Dices className="size-4" aria-hidden="true" />
            Your game night starts here
          </p>

          <h1
            id="hero-heading"
            className="mt-6 font-heading text-4xl leading-tight font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Plan the Perfect{" "}
            <span className="block text-brand-highlight">Board Game Night</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-xl">
            Discover games, organize events, invite friends, and build your collection — all
            in one place.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href={ROUTES.findGame}
              className={cn(
                buttonVariants(),
                "h-13 rounded-xl bg-cta px-8 text-lg font-bold text-cta-foreground hover:bg-cta/90",
              )}
            >
              Find a Game
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              href={ROUTES.createGameNight}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-13 rounded-xl border-white/30 bg-white/10 px-8 text-lg font-bold text-white hover:bg-white/20 hover:text-white",
              )}
            >
              Host a Night
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl lg:max-w-none">
          {image ? (
            <img
              src={image.src}
              alt={image.alt}
              className="aspect-4/3 w-full rounded-2xl object-cover shadow-2xl"
            />
          ) : (
            <HeroImagePlaceholder />
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
