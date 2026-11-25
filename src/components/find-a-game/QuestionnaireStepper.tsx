import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionnaireStepperProps {
  steps: ReadonlyArray<{ id: string; label: string }>;
  /** Zero-based index of the current step. */
  current: number;
}

/** Progress indicator: completed steps show a check mark and the current step is highlighted. */
function QuestionnaireStepper({ steps, current }: QuestionnaireStepperProps) {
  return (
    <nav aria-label="Questionnaire progress">
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <Fragment key={step.id}>
              {index > 0 && (
                <li
                  aria-hidden="true"
                  className={cn(
                    "mx-1 mt-4.5 h-0.5 flex-1 rounded-full sm:mx-2",
                    index <= current ? "bg-brand-strong" : "bg-border",
                  )}
                />
              )}
              <li
                aria-current={active ? "step" : undefined}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-20"
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-sm font-bold",
                    done || active
                      ? "bg-brand-strong text-brand-foreground"
                      : "bg-stone-200/70 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-center text-xs sm:text-sm",
                    active ? "font-semibold text-brand-strong" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                  <span className="sr-only">
                    {done ? " (completed)" : active ? " (current step)" : ""}
                  </span>
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export default QuestionnaireStepper;
