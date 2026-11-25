import ChoiceCard from "@/components/find-a-game/ChoiceCard";
import { EXPERIENCE_OPTIONS } from "@/lib/find-game/questionnaire";
import type { ExperienceLevel } from "@/types/recommendation";

interface DetailsStepProps {
  value: ExperienceLevel | null;
  onChange: (value: ExperienceLevel | null) => void;
}

/** Optional experience level. "No preference" leaves experience_level out of the request. */
function DetailsStep({ value, onChange }: DetailsStepProps) {
  return (
    <fieldset>
      <legend className="sr-only">Experience level (optional)</legend>
      <div className="grid gap-3">
        {EXPERIENCE_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.value ?? "none"}
            name="experience"
            value={option.value ?? "none"}
            checked={value === option.value}
            onSelect={() => onChange(option.value)}
            label={option.label}
            hint={option.hint}
          />
        ))}
      </div>
    </fieldset>
  );
}

export default DetailsStep;
