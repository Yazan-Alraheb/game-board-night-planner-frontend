"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildUpdatePayload,
  hasEditChanges,
  hasErrors,
  toEditFormValues,
  validateEditForm,
  type EditField,
  type EditFormErrors,
  type EditFormValues,
} from "@/lib/game-nights/details";
import { cn } from "@/lib/utils";
import type { GameNightResponse, GameNightUpdate } from "@/types/game-night";

export type SaveOutcome =
  | { ok: true }
  | { ok: false; message: string; fieldErrors: EditFormErrors }
  /** The parent took over (e.g. the night is gone); the form shouldn't update itself. */
  | { ok: "handled" };

interface EditGameNightFormProps {
  gameNight: GameNightResponse;
  onSave: (payload: GameNightUpdate) => Promise<SaveOutcome>;
  onCancel: () => void;
  /** Saving would change nothing: the parent closes the form with a notice. */
  onNoChanges: () => void;
}

const FIELD_ORDER: EditField[] = ["name", "startsAt", "location", "notes"];

// Same input look as the Create Game Night form, plus a visible error state.
const INPUT_CLASSES =
  "rounded-xl border px-4 py-3 font-normal focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive";

/** Host-only form for name, start time, location and notes (the fields PUT accepts). */
function EditGameNightForm({ gameNight, onSave, onCancel, onNoChanges }: EditGameNightFormProps) {
  // Initialised once: later refreshes of the night don't overwrite what the host typed.
  const [values, setValues] = useState<EditFormValues>(() => toEditFormValues(gameNight));
  const [errors, setErrors] = useState<EditFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const fieldRefs = useRef<Partial<Record<EditField, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    fieldRefs.current.name?.focus();
  }, []);

  const set = (field: EditField) => (event: { target: { value: string } }) => {
    const value = event.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear a field's error as soon as it's edited.
    setErrors(({ [field]: _cleared, ...rest }) => rest);
  };

  function focusFirstError(found: EditFormErrors) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) fieldRefs.current[first]?.focus();
    else formErrorRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    const found = validateEditForm(values, gameNight, Date.now());
    setErrors(found);
    setFormError(null);
    if (hasErrors(found)) {
      focusFirstError(found);
      return;
    }
    if (!hasEditChanges(values, gameNight)) {
      onNoChanges();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const outcome = await onSave(buildUpdatePayload(values, gameNight));
    if (outcome.ok === "handled" || outcome.ok === true) return; // The parent closes the form.

    submittingRef.current = false;
    setSubmitting(false);
    setErrors(outcome.fieldErrors);
    setFormError(outcome.message);
    requestAnimationFrame(() => focusFirstError(outcome.fieldErrors));
  }

  const fieldProps = (field: EditField) => ({
    ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => {
      fieldRefs.current[field] = element;
    },
    id: `edit-${field}`,
    value: values[field],
    onChange: set(field),
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": [errors[field] && `edit-${field}-error`, field === "startsAt" && "edit-startsAt-hint"]
      .filter(Boolean)
      .join(" ") || undefined,
    className: INPUT_CLASSES,
  });

  const fieldError = (field: EditField) =>
    errors[field] && (
      <span id={`edit-${field}-error`} className="text-sm font-medium text-destructive">
        {errors[field]}
      </span>
    );

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby="edit-game-night-heading" aria-busy={submitting}>
      <h2 id="edit-game-night-heading" className="font-heading text-xl font-bold">
        Edit game night
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Changes are visible to everyone on this game night. Attendees and games stay as they are.
      </p>

      <fieldset disabled={submitting} className="mt-5 grid gap-4 text-sm font-medium sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="edit-name">Name</label>
          <input {...fieldProps("name")} required autoComplete="off" />
          {fieldError("name")}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="edit-startsAt">Date &amp; time</label>
          <input {...fieldProps("startsAt")} type="datetime-local" required />
          <span id="edit-startsAt-hint" className="text-xs font-normal text-muted-foreground">
            In your time zone ({timeZone})
          </span>
          {fieldError("startsAt")}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="edit-location">Location</label>
          <input {...fieldProps("location")} required />
          {fieldError("location")}
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="edit-notes">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea {...fieldProps("notes")} rows={3} className={cn(INPUT_CLASSES, "resize-y")} />
          {fieldError("notes")}
        </div>
      </fieldset>

      {formError && (
        <p
          ref={formErrorRef}
          tabIndex={-1}
          role="alert"
          className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive focus-visible:outline-none"
        >
          {formError}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-brand-strong px-5 font-semibold text-brand-strong hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
        >
          Cancel editing
        </button>
        <Button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-xl bg-brand-strong px-5 text-base font-semibold text-brand-foreground hover:bg-brand"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export default EditGameNightForm;
