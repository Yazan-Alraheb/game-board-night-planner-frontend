"use client";

import { useId, useState } from "react";
import ChoiceCard from "@/components/find-a-game/ChoiceCard";
import FieldError from "@/components/find-a-game/FieldError";
import { cn } from "@/lib/utils";

interface Preset {
  value: string;
  label: string;
  hint?: string;
}

interface PresetOrCustomNumberProps {
  /** Radio group name, which must be unique on the page. */
  name: string;
  legend: string;
  description?: string;
  presets: ReadonlyArray<Preset>;
  /** Current raw value; "" means nothing chosen. */
  value: string;
  onChange: (value: string) => void;
  customLabel: string;
  /** Unit text shown after the input, e.g. "players" or "minutes". */
  unit: string;
  max: number;
  error?: string;
  variant: "tile" | "row";
}

/**
 * Single-choice question with preset options plus an exact number input.
 * The input is text with inputMode="numeric" (not type="number") so the exact
 * typed text is kept and validated, instead of the browser turning "3e" into "".
 */
function PresetOrCustomNumber({
  name,
  legend,
  description,
  presets,
  value,
  onChange,
  customLabel,
  unit,
  max,
  error,
  variant,
}: PresetOrCustomNumberProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const inputId = `${id}-custom`;

  const isPreset = presets.some((preset) => preset.value === value);
  // The input keeps its own text so typing "3" doesn't jump to the "3" preset and clear the field.
  const [customText, setCustomText] = useState(isPreset ? "" : value);

  const describedBy = [description ? descriptionId : null, errorId].filter(Boolean).join(" ");

  return (
    <fieldset aria-describedby={describedBy}>
      <legend className="font-heading text-lg font-bold">{legend}</legend>
      {description && (
        <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div
        className={cn(
          "mt-4 grid gap-3",
          variant === "tile" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1",
        )}
      >
        {presets.map((preset) => (
          <ChoiceCard
            key={preset.value}
            name={name}
            value={preset.value}
            checked={isPreset && value === preset.value && customText === ""}
            onSelect={() => {
              setCustomText("");
              onChange(preset.value);
            }}
            label={preset.label}
            hint={preset.hint}
            variant={variant}
            describedBy={errorId}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {customLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={`1–${max}`}
            value={customText}
            onChange={(event) => {
              setCustomText(event.target.value);
              onChange(event.target.value);
            }}
            aria-invalid={error && !isPreset ? true : undefined}
            aria-describedby={errorId}
            className={cn(
              "h-11 w-24 rounded-xl border-2 bg-white px-3 text-base outline-none transition-colors",
              "focus-visible:border-brand-strong focus-visible:ring-3 focus-visible:ring-brand/30",
              customText !== "" ? "border-brand-strong" : "border-border",
              "aria-invalid:border-destructive",
            )}
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
      </div>

      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

export default PresetOrCustomNumber;
