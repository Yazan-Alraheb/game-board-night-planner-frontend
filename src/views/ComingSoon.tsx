import Link from "next/link";
import { Construction } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

interface ComingSoonProps {
  title: string;
}

/** PLACEHOLDER page for navigation targets that have not been built yet. */
function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <Construction className="size-12 text-brand" aria-hidden="true" />
      <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        This page is a placeholder and hasn&apos;t been built yet.
      </p>
      <Link
        href={ROUTES.home}
        className={cn(buttonVariants(), "mt-8 h-11 rounded-xl bg-brand-strong px-6 text-base hover:bg-brand")}
      >
        Back to home
      </Link>
    </div>
  );
}

export default ComingSoon;
