"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuestionnaireStepper from "@/components/find-a-game/QuestionnaireStepper";
import GroupStep from "@/components/find-a-game/steps/GroupStep";
import PreferencesStep from "@/components/find-a-game/steps/PreferencesStep";
import DetailsStep from "@/components/find-a-game/steps/DetailsStep";
import ReviewStep from "@/components/find-a-game/steps/ReviewStep";
import { useLazyResource } from "@/hooks/useLazyResource";
import { getGameNights } from "@/api/game-nights";
import { getGameCategories } from "@/api/games";
import {
  LAST_STEP,
  STEPS,
  buildRecommendationRequest,
  hasErrors,
  questionnaireReducer,
  validateStep,
  type FieldErrors,
  type StepIndex,
} from "@/lib/find-game/questionnaire";
import { findSelectedGameNight } from "@/lib/find-game/game-nights";
import { clearDraft, loadDraft, saveDraft } from "@/lib/find-game/storage";
import { clearSubmittedRequest, saveSubmittedRequest } from "@/lib/find-game/submitted-request";
import { ROUTES } from "@/lib/routes";

const STEP_HEADINGS: Record<StepIndex, { title: string; description: string }> = {
  0: {
    title: "How do you want to find games?",
    description: "Pick games from your own collection, or from everyone coming to a game night.",
  },
  1: {
    title: "How long do you want to play?",
    description: "Choose a maximum play time and, if you like, your favourite categories.",
  },
  2: {
    title: "What's your experience level?",
    description: "Optional. We'll tailor the recommendations to your experience.",
  },
  3: {
    title: "Ready to find your game!",
    description: "Check your answers. You can still change anything before getting recommendations.",
  },
};

interface FindGameWizardProps {
  userId: number;
}

function FindGameWizard({ userId }: FindGameWizardProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(questionnaireReducer, userId, loadDraft);
  const { step, answers } = state;

  // Errors stay hidden until the user tries to continue from the current step.
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errors: FieldErrors = showErrors ? validateStep(step, answers) : {};
  const stepComplete = !hasErrors(validateStep(step, answers));

  // Data for the questions. Each is fetched once, only when first needed.
  const [gameNights, retryGameNights] = useLazyResource(getGameNights, answers.mode === "game_night");
  const [categories, retryCategories] = useLazyResource(getGameCategories, step >= 1);

  // Save the answers so Back/Next, a refresh and the results page all see the same state.
  useEffect(() => {
    saveDraft(userId, state);
  }, [userId, state]);

  // A saved game night that is no longer in the user's list (deleted, or the user
  // left it) must not be submitted. Clear it so the user picks again.
  useEffect(() => {
    if (
      gameNights.status === "success" &&
      answers.gameNightId !== null &&
      !gameNights.data.some((gameNight) => gameNight.id === answers.gameNightId)
    ) {
      dispatch({ type: "setGameNight", id: null });
    }
  }, [gameNights, answers.gameNightId]);

  // Move focus to the new step's heading so keyboard and screen reader users start at the top.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function goToStep(target: StepIndex) {
    setShowErrors(false);
    dispatch({ type: "goToStep", step: target });
  }

  function handleBack() {
    if (step > 0) goToStep((step - 1) as StepIndex);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < LAST_STEP) {
      if (!stepComplete) {
        setShowErrors(true);
        return;
      }
      goToStep((step + 1) as StepIndex);
      return;
    }

    // Final step: check every answer again. The saved draft could have been changed.
    const result = buildRecommendationRequest(answers);
    if (!result.ok) {
      dispatch({ type: "goToStep", step: result.step });
      setShowErrors(true);
      return;
    }

    // A game night is only submitted when the user's loaded list confirms it.
    // A missing id is cleared so the picker asks again. If the list is still
    // loading or failed, go back so the user sees that state (and can retry).
    if (
      result.request.mode === "game_night" &&
      !findSelectedGameNight(gameNights, result.request.game_night_id)
    ) {
      if (gameNights.status === "success") dispatch({ type: "setGameNight", id: null });
      dispatch({ type: "goToStep", step: 0 });
      setShowErrors(true);
      return;
    }

    // Save the validated request as its own snapshot for the recommendations page.
    // Nothing (and nothing private) goes into the URL.
    saveDraft(userId, state);
    if (!saveSubmittedRequest(userId, result.request)) {
      setSubmitError("Couldn't save your answers in this browser tab. Check that site storage is allowed and try again.");
      return;
    }
    setSubmitError(null);
    router.push(ROUTES.recommendations);
  }

  function handleStartOver() {
    clearDraft();
    clearSubmittedRequest();
    setSubmitError(null);
    setShowErrors(false);
    dispatch({ type: "reset" });
  }

  const heading = STEP_HEADINGS[step];

  return (
    <div className="bg-surface-warm">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Find the Perfect Game for You
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Answer a few questions and we&apos;ll suggest the best board games for your group.
          </p>
        </header>

        <div className="mt-8 sm:mt-10">
          <QuestionnaireStepper steps={STEPS} current={step} />
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-8">
          <section
            aria-labelledby="step-heading"
            className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-8"
          >
            <p className="text-sm font-medium text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2
              id="step-heading"
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 font-heading text-xl font-bold tracking-tight outline-none sm:text-2xl"
            >
              {heading.title}
            </h2>
            <p className="mt-1.5 text-muted-foreground">{heading.description}</p>

            <div className="mt-6">
              {step === 0 && (
                <GroupStep
                  answers={answers}
                  errors={errors}
                  gameNights={gameNights}
                  onRetryGameNights={retryGameNights}
                  currentUserId={userId}
                  onModeChange={(mode) => dispatch({ type: "setMode", mode })}
                  onPlayerCountChange={(value) => dispatch({ type: "setPlayerCount", value })}
                  onGameNightChange={(id) => dispatch({ type: "setGameNight", id })}
                />
              )}
              {step === 1 && (
                <PreferencesStep
                  answers={answers}
                  errors={errors}
                  categories={categories}
                  onRetryCategories={retryCategories}
                  onMaxPlaytimeChange={(value) => dispatch({ type: "setMaxPlaytime", value })}
                  onToggleCategory={(category) => dispatch({ type: "toggleCategory", category })}
                />
              )}
              {step === 2 && (
                <DetailsStep
                  value={answers.experienceLevel}
                  onChange={(value) => dispatch({ type: "setExperience", value })}
                />
              )}
              {step === 3 && (
                <ReviewStep answers={answers} gameNights={gameNights} onEdit={goToStep} />
              )}
            </div>
          </section>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 0}
              className="h-11 rounded-xl bg-white px-5 text-base"
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>

            {step < LAST_STEP ? (
              // Always fully enabled: pressing it on an incomplete step shows what's missing.
              <Button
                type="submit"
                className="h-11 rounded-xl bg-brand-strong px-6 text-base font-semibold text-brand-foreground hover:bg-brand"
              >
                Next
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="submit"
                className="h-12 rounded-xl bg-brand-strong px-5 text-base font-bold text-brand-foreground hover:bg-brand sm:px-7"
              >
                <Sparkles aria-hidden="true" />
                Get Recommendations
                <ArrowRight aria-hidden="true" className="hidden sm:block" />
              </Button>
            )}
          </div>

          <p role="alert" className="mt-3 text-right text-sm font-medium text-destructive empty:hidden">
            {step === LAST_STEP ? submitError : null}
          </p>

          {step === LAST_STEP && (
            <div className="mt-4 text-center">
              <Button
                type="button"
                variant="ghost"
                onClick={handleStartOver}
                className="h-10 rounded-xl px-3 text-muted-foreground"
              >
                <RotateCcw aria-hidden="true" />
                Start over
              </Button>
            </div>
          )}
        </form>

        <aside className="mt-8 rounded-2xl bg-stone-200/50 px-5 py-4">
          <p className="font-semibold">Not sure?</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            That&apos;s okay! We&apos;ll help you find a great game no matter your experience level.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default FindGameWizard;
