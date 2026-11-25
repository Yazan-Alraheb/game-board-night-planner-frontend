import { User, Users } from "lucide-react";
import ChoiceCard from "@/components/find-a-game/ChoiceCard";
import FieldError from "@/components/find-a-game/FieldError";
import GameNightPicker from "@/components/find-a-game/GameNightPicker";
import PresetOrCustomNumber from "@/components/find-a-game/PresetOrCustomNumber";
import type { LazyResource } from "@/hooks/useLazyResource";
import {
  MAX_PLAYERS,
  PLAYER_COUNT_PRESETS,
  type FieldErrors,
  type QuestionnaireAnswers,
} from "@/lib/find-game/questionnaire";
import type { GameNightResponse } from "@/types/game-night";
import type { RecommendationMode } from "@/types/recommendation";

interface GroupStepProps {
  answers: QuestionnaireAnswers;
  errors: FieldErrors;
  gameNights: LazyResource<GameNightResponse[]>;
  onRetryGameNights: () => void;
  currentUserId: number;
  onModeChange: (mode: RecommendationMode) => void;
  onPlayerCountChange: (value: string) => void;
  onGameNightChange: (id: number) => void;
}

const MODE_OPTIONS = [
  {
    value: "personal",
    label: "My Collection",
    hint: "Games you own",
    icon: <User className="size-8" strokeWidth={1.75} />,
  },
  {
    value: "game_night",
    label: "Game Night",
    hint: "Combined collections of an event",
    icon: <Users className="size-8" strokeWidth={1.75} />,
  },
] as const;

function GroupStep({
  answers,
  errors,
  gameNights,
  onRetryGameNights,
  currentUserId,
  onModeChange,
  onPlayerCountChange,
  onGameNightChange,
}: GroupStepProps) {
  const modeErrorId = "mode-error";

  return (
    <div className="space-y-8">
      <fieldset aria-describedby={modeErrorId}>
        <legend className="sr-only">Where should the games come from?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              name="mode"
              value={option.value}
              checked={answers.mode === option.value}
              onSelect={() => onModeChange(option.value)}
              label={option.label}
              hint={option.hint}
              icon={option.icon}
              variant="tile"
              describedBy={modeErrorId}
            />
          ))}
        </div>
        <FieldError id={modeErrorId} message={errors.mode} />
      </fieldset>

      {answers.mode === "personal" && (
        <PresetOrCustomNumber
          name="player-count"
          legend="How many people will be playing?"
          description="Including you. We'll only suggest games that support exactly this many players."
          presets={PLAYER_COUNT_PRESETS}
          value={answers.playerCount}
          onChange={onPlayerCountChange}
          customLabel="Or enter an exact number:"
          unit="players"
          max={MAX_PLAYERS}
          error={errors.playerCount}
          variant="tile"
        />
      )}

      {answers.mode === "game_night" && (
        <GameNightPicker
          gameNights={gameNights}
          selectedId={answers.gameNightId}
          onSelect={onGameNightChange}
          onRetry={onRetryGameNights}
          currentUserId={currentUserId}
          error={errors.gameNightId}
        />
      )}
    </div>
  );
}

export default GroupStep;
