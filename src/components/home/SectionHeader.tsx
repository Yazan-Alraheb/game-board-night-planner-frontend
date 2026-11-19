import type { ReactNode } from "react";
import Link from "next/link";

interface SectionHeaderProps {
  id: string;
  title: string;
  action?: { label: ReactNode; to: string };
}

/** Section title with an optional link on the right, e.g. "Discover Games … View All →". */
function SectionHeader({ id, title, action }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h2 id={id} className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {action && (
        <Link
          href={action.to}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md text-base font-medium text-brand hover:text-brand-strong hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:text-lg"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export default SectionHeader;
