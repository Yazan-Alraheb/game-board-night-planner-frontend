import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import FieldError from "@/components/find-a-game/FieldError";
import type { LazyResource } from "@/hooks/useLazyResource";
import { cn } from "@/lib/utils";

interface CategoryPickerProps {
  categories: LazyResource<string[]>;
  selected: string[];
  onToggle: (category: string) => void;
  onRetry: () => void;
  error?: string;
}

/** Optional multi-select of the categories that exist in the game catalog. */
function CategoryPicker({ categories, selected, onToggle, onRetry, error }: CategoryPickerProps) {
  const errorId = "categories-error";
  const hintId = "categories-hint";

  // Keep showing earlier selections even if they are no longer in the catalog,
  // so the user can still see and remove them.
  const loaded = categories.status === "success" ? categories.data : [];
  const options = [...loaded, ...selected.filter((category) => !loaded.includes(category))];

  return (
    <fieldset aria-describedby={`${hintId} ${errorId}`}>
      <legend className="font-heading text-base font-bold">
        Preferred categories <span className="font-normal text-muted-foreground">(optional)</span>
      </legend>
      <p id={hintId} className="mt-1 text-sm text-muted-foreground">
        Choose as many as you like. Categories rank matching games higher; they don&apos;t filter
        other games out.
      </p>

      {(categories.status === "loading" || categories.status === "idle") && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Loading categories…
        </p>
      )}

      {categories.status === "error" && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">Couldn&apos;t load categories.</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry} className="rounded-lg">
            Try again
          </Button>
        </div>
      )}

      {categories.status === "success" && options.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No categories are available yet.</p>
      )}

      {options.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {options.map((category) => {
            const checked = selected.includes(category);
            return (
              <li key={category}>
                <label
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                    "has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-brand/40",
                    checked
                      ? "border-brand-strong bg-brand-strong text-brand-foreground"
                      : "border-border bg-white text-foreground hover:border-brand/60 hover:bg-brand-soft/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(category)}
                    className="sr-only"
                  />
                  {checked && <Check className="size-4" aria-hidden="true" />}
                  {category}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

export default CategoryPicker;
