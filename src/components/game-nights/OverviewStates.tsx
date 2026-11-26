import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarX2, Plus, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export const PRIMARY_LINK_CLASSES =
  "h-11 rounded-xl bg-brand-strong px-5 text-base font-semibold text-brand-foreground hover:bg-brand";

export function CreateGameNightLink({ className }: { className?: string }) {
  return (
    <Link href={ROUTES.createGameNight} className={cn(buttonVariants(), PRIMARY_LINK_CLASSES, className)}>
      <Plus className="size-4" aria-hidden="true" />
      Create Game Night
    </Link>
  );
}

export function OverviewSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading your game nights…
      </p>
      <ul aria-hidden="true" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <li key={index}>
            <Card className="gap-0 rounded-2xl p-6 sm:p-7">
              <div className="flex justify-between gap-4">
                <div className="h-6 w-2/3 animate-pulse rounded-md bg-muted" />
                <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="mt-5 h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-4 w-2/5 animate-pulse rounded bg-muted" />
              <div className="mt-6 flex -space-x-2">
                {[0, 1, 2].map((avatar) => (
                  <span key={avatar} className="size-10 animate-pulse rounded-full bg-muted ring-2 ring-white" />
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-white/60 px-6 py-12 text-center">
      <CalendarX2 className="size-10 text-brand-strong/60" aria-hidden="true" />
      <p className="mt-4 font-heading text-lg font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-md text-muted-foreground">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function LoadErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border bg-white px-6 py-12 text-center">
      <p role="alert" className="max-w-md font-medium text-destructive">
        {message}
      </p>
      <Button
        type="button"
        onClick={onRetry}
        className={cn("mt-6", PRIMARY_LINK_CLASSES)}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Try Again
      </Button>
    </div>
  );
}
