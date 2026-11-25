import type { ReactNode } from "react";
import { CalendarDays, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MODE_LABELS,
  formatExperience,
  formatMaxPlaytime,
} from "@/lib/find-game/questionnaire";
import { formatEventDate, formatPlayerCount } from "@/lib/format";
import type { GameNightResponse } from "@/types/game-night";
import type { RecommendationRequest } from "@/types/recommendation";

interface AnswersSummaryProps {
  /** The submitted request these results are for, not the editable draft. */
  request: RecommendationRequest;
  /** Event details in game-night mode, if they loaded. */
  gameNight: GameNightResponse | null;
  onEdit: () => void;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <li className="rounded-full border border-border bg-white px-3.5 py-1.5 text-sm text-foreground">
      {children}
    </li>
  );
}

/** "Based on your answers" card: what these results were calculated for, plus Edit. */
function AnswersSummary({ request, gameNight, onEdit }: AnswersSummaryProps) {
  return (
    <section
      aria-labelledby="answers-heading"
      className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="answers-heading" className="font-heading text-lg font-bold">
            Based on your answers
          </h2>
          {request.mode === "game_night" && gameNight && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="break-words">
                {gameNight.name} · <time dateTime={gameNight.starts_at}>{formatEventDate(gameNight.starts_at)}</time>
              </span>
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onEdit}
          className="h-10 rounded-xl px-4 text-brand-strong hover:bg-brand-soft hover:text-brand-strong"
        >
          <Pencil aria-hidden="true" />
          Edit answers
        </Button>
      </div>

      <ul aria-label="Your answers" className="mt-4 flex flex-wrap gap-2">
        <Chip>{MODE_LABELS[request.mode]}</Chip>
        {request.mode === "personal" ? (
          <Chip>{formatPlayerCount(request.player_count)}</Chip>
        ) : (
          <Chip>
            {request.player_count !== undefined
              ? formatPlayerCount(request.player_count)
              : "Everyone who accepted"}
          </Chip>
        )}
        <Chip>{formatMaxPlaytime(String(request.max_playtime))}</Chip>
        {(request.categories ?? []).map((category) => (
          <Chip key={category}>{category}</Chip>
        ))}
        {request.experience_level && <Chip>{formatExperience(request.experience_level)}</Chip>}
      </ul>
    </section>
  );
}

export default AnswersSummary;
