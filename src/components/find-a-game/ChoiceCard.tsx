import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChoiceCardProps {
  /** Radio group name. Radios with the same name form one keyboard group (arrow keys). */
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Extra content shown on the right of a row card or below a tile, such as badges. */
  aside?: ReactNode;
  /** "tile": centred box (Figma group step). "row": full-width line (Figma playtime step). */
  variant?: "tile" | "row";
  /** Id of an error or hint message that describes the whole group. */
  describedBy?: string;
}

/**
 * One option of a single-choice question.
 *
 * Uses a real (visually hidden) radio input so browsers and screen readers handle
 * selection, arrow-key navigation and announcements natively.
 */
function ChoiceCard({
  name,
  value,
  checked,
  onSelect,
  label,
  hint,
  icon,
  aside,
  variant = "row",
  describedBy,
}: ChoiceCardProps) {
  const isTile = variant === "tile";

  return (
    <label
      className={cn(
        "relative flex min-h-14 cursor-pointer gap-3 rounded-2xl border-2 bg-white transition-colors",
        "hover:border-brand/60 hover:bg-brand-soft/40",
        "has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-brand/40",
        checked ? "border-brand-strong bg-brand-soft hover:bg-brand-soft" : "border-border",
        isTile
          ? "flex-col items-center justify-center px-4 py-6 text-center sm:py-8"
          : "items-center px-4 py-3 sm:px-5",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        aria-describedby={describedBy}
        className="sr-only"
      />

      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center",
            checked ? "text-brand-strong" : "text-muted-foreground",
          )}
        >
          {icon}
        </span>
      )}

      <span className={cn("flex min-w-0 flex-col gap-0.5", !isTile && "flex-1")}>
        <span className={cn("font-semibold", checked ? "text-brand-strong" : "text-foreground")}>
          {label}
        </span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </span>

      {aside}

      {checked && (
        <CheckCircle2
          aria-hidden="true"
          className={cn("size-5 shrink-0 text-brand-strong", isTile && "absolute top-3 right-3")}
        />
      )}
    </label>
  );
}

export default ChoiceCard;
