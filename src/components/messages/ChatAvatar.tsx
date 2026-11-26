import { getInitials, placeholderColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types/friend";

/** Decorative: the person's name is always shown as text next to it. */
export default function ChatAvatar({ person, className }: { person: PublicUser; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        placeholderColor(person.id),
        className,
      )}
    >
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        getInitials(person.name)
      )}
    </span>
  );
}

/** Visible keyboard focus for the list buttons. */
export const focusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
