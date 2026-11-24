import CategoryPicker from "@/components/find-a-game/CategoryPicker";
import PresetOrCustomNumber from "@/components/find-a-game/PresetOrCustomNumber";
import type { LazyResource } from "@/hooks/useLazyResource";
import {
  MAX_PLAYTIME_MINUTES,
  PLAYTIME_PRESETS,
  type FieldErrors,
  type QuestionnaireAnswers,
} from "@/lib/find-game/questionnaire";

interface PreferencesStepProps {
  answers: QuestionnaireAnswers;
  errors: FieldErrors;
  categories: LazyResource<string[]>;
  onRetryCategories: () => void;
  onMaxPlaytimeChange: (value: string) => void;
  onToggleCategory: (category: string) => void;
}

function PreferencesStep({
  answers,
  errors,
  categories,
  onRetryCategories,
  onMaxPlaytimeChange,
  onToggleCategory,
}: PreferencesStepProps) {
  return (
    <div className="space-y-8">
      <PresetOrCustomNumber
        name="max-playtime"
        legend="Maximum play time"
        description="We'll only suggest games that can be finished within this time."
        presets={PLAYTIME_PRESETS}
        value={answers.maxPlaytime}
        onChange={onMaxPlaytimeChange}
        customLabel="Or enter a maximum:"
        unit="minutes"
        max={MAX_PLAYTIME_MINUTES}
        error={errors.maxPlaytime}
        variant="row"
      />

      <CategoryPicker
        categories={categories}
        selected={answers.categories}
        onToggle={onToggleCategory}
        onRetry={onRetryCategories}
        error={errors.categories}
      />
    </div>
  );
}

export default PreferencesStep;
