import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LazyResource } from "@/hooks/useLazyResource";
import { formatEventDate, formatPlayerCount } from "@/lib/format";
import { findSelectedGameNight } from "@/lib/find-game/game-nights";
import {
  MAX_PLAYERS,
  MODE_LABELS,
  formatExperience,
  formatMaxPlaytime,
  parsePositiveInteger,
  type QuestionnaireAnswers,
  type StepIndex,
} from "@/lib/find-game/questionnaire";
import type { GameNightResponse } from "@/types/game-night";

interface ReviewStepProps {
  answers: QuestionnaireAnswers;
  gameNights: LazyResource<GameNightResponse[]>;
  onEdit: (step: StepIndex) => void;
}

interface SummaryRowProps {
  label: string;
  editStep: StepIndex;
  onEdit: (step: StepIndex) => void;
  children: ReactNode;
}

function SummaryRow({ label, editStep, onEdit, children }: SummaryRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-semibold break-words">{children}</dd>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onEdit(editStep)}
        className="h-10 shrink-0 rounded-xl px-3 text-brand-strong hover:bg-brand-soft hover:text-brand-strong"
      >
        <Pencil aria-hidden="true" />
        Edit<span className="sr-only"> {label.toLowerCase()}</span>
      </Button>
    </div>
  );
}

/** Summary of all answers, with an Edit button for each one that goes back to its step. */
function ReviewStep({ answers, gameNights, onEdit }: ReviewStepProps) {
  const playerCount = parsePositiveInteger(answers.playerCount, MAX_PLAYERS);
  const gameNight = findSelectedGameNight(gameNights, answers.gameNightId);

  // What to show when there is no confirmed event. A name is only ever shown for a confirmed one.
  let gameNightFallback = "Not selected";
  if (answers.gameNightId !== null && (gameNights.status === "loading" || gameNights.status === "idle")) {
    gameNightFallback = "Loading event details…";
  } else if (answers.gameNightId !== null && gameNights.status === "error") {
    gameNightFallback = "Couldn't load event details";
  }

  return (
    <dl className="divide-y divide-border">
      <SummaryRow label="Find games from" editStep={0} onEdit={onEdit}>
        {answers.mode ? MODE_LABELS[answers.mode] : "Not set"}
      </SummaryRow>

      {answers.mode === "personal" && (
        <SummaryRow label="Players" editStep={0} onEdit={onEdit}>
          {playerCount === null ? "Not set" : formatPlayerCount(playerCount)}
        </SummaryRow>
      )}

      {answers.mode === "game_night" && (
        <SummaryRow label="Game night" editStep={0} onEdit={onEdit}>
          {gameNight ? (
            <>
              {gameNight.name}
              <span className="block text-sm font-normal text-muted-foreground">
                <time dateTime={gameNight.starts_at}>{formatEventDate(gameNight.starts_at)}</time>
                {" · "}
                {gameNight.location}
              </span>
            </>
          ) : (
            gameNightFallback
          )}
          <span className="block text-sm font-normal text-muted-foreground">
            Players: everyone who has accepted, including the host
          </span>
        </SummaryRow>
      )}

      <SummaryRow label="Maximum play time" editStep={1} onEdit={onEdit}>
        {formatMaxPlaytime(answers.maxPlaytime)}
      </SummaryRow>

      <SummaryRow label="Categories" editStep={1} onEdit={onEdit}>
        {answers.categories.length > 0 ? answers.categories.join(", ") : "Any category"}
      </SummaryRow>

      <SummaryRow label="Experience level" editStep={2} onEdit={onEdit}>
        {formatExperience(answers.experienceLevel)}
      </SummaryRow>
    </dl>
  );
}

export default ReviewStep;
