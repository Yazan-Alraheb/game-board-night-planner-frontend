import { AlertCircle } from "lucide-react";

interface FieldErrorProps {
  id: string;
  message: string | undefined;
}

/**
 * Validation message for a question.
 *
 * The element with this id always exists, so `aria-describedby` references stay valid.
 * The message is announced when it appears.
 */
function FieldError({ id, message }: FieldErrorProps) {
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive empty:hidden">
      {message && (
        <span className="mt-3 flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {message}
        </span>
      )}
    </p>
  );
}

export default FieldError;
