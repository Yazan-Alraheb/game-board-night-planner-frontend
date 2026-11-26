import { Button } from "@/components/ui/button";
import type { LazyResource } from "@/hooks/useLazyResource";
import { categoryOptions } from "@/lib/games/browse-filters";

interface CategoryFilterProps {
  /** Categories from the game catalog (see getGameCategories). */
  categories: LazyResource<string[]>;
  value: string;
  onChange: (category: string) => void;
  onRetry: () => void;
  className?: string;
}

/**
 * Category dropdown for Browse Games. "All categories" always works, even while the
 * list is loading or after it failed, so the other filters stay usable.
 */
function CategoryFilter({ categories, value, onChange, onRetry, className }: CategoryFilterProps) {
  const loading = categories.status === "idle" || categories.status === "loading";
  const options = categoryOptions(categories.status === "success" ? categories.data : null, value);
  const statusId = "category-status";

  return (
    <div>
      <label htmlFor="category" className="mb-2 block font-semibold">
        Category
      </label>

      <select
        id="category"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={categories.status === "success" && options.length > 0 ? undefined : statusId}
        className={className}
      >
        <option value="">All categories</option>
        {options.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      {loading && (
        <p id={statusId} role="status" className="mt-1 text-sm text-muted-foreground">
          Loading categories…
        </p>
      )}

      {categories.status === "error" && (
        <div id={statusId} role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-destructive">Couldn&apos;t load categories.</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry} className="rounded-lg">
            Try again
          </Button>
        </div>
      )}

      {categories.status === "success" && options.length === 0 && (
        <p id={statusId} className="mt-1 text-sm text-muted-foreground">
          No categories are available yet.
        </p>
      )}
    </div>
  );
}

export default CategoryFilter;
