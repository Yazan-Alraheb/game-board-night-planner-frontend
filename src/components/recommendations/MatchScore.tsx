import { cn } from "@/lib/utils";

interface MatchScoreProps {
  /** Backend score, 0–100. Shown rounded; never changes the order. */
  score: number;
  size?: "default" | "sm";
}

/** "87% match" plus a bar. The text carries the meaning, and the bar is decorative. */
function MatchScore({ score, size = "default" }: MatchScoreProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const rounded = Math.round(clamped);

  return (
    <div className="flex items-center gap-3">
      <p className={cn("shrink-0 font-bold text-brand-strong", size === "sm" ? "text-sm" : "text-base")}>
        {rounded}% <span className="font-medium">match</span>
      </p>
      <div aria-hidden="true" className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-brand-soft">
        <div className="h-full rounded-full bg-brand-strong" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export default MatchScore;
