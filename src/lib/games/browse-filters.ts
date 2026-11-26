import type { GetGamesParams } from "@/api/games";

export type Difficulty = "Easy" | "Medium" | "Hard";

/** Browse Games filter inputs, as the form holds them ("" means "any"). */
export interface BrowseFilters {
  search: string;
  players: string;
  category: string;
  difficulty: Difficulty | "";
  playtime: string;
}

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
  search: "",
  players: "",
  category: "",
  difficulty: "",
  playtime: "",
};

/**
 * Query parameters for GET /api/games. Empty filters are left out; the category is sent
 * exactly as the catalog spells it (Axios encodes spaces, e.g. "Card Game").
 */
export function browseGamesParams(filters: BrowseFilters, page: number, limit: number): GetGamesParams {
  return {
    page,
    limit,
    search: filters.search || undefined,
    players: filters.players ? Number(filters.players) : undefined,
    category: filters.category || undefined,
    difficulty: filters.difficulty || undefined,
    playtime: filters.playtime ? Number(filters.playtime) : undefined,
  };
}

/**
 * The category options: the catalog's categories (null while unknown), plus the current
 * selection if the catalog no longer has it, so the select never silently changes value.
 */
export function categoryOptions(catalog: readonly string[] | null, selected: string): string[] {
  const options = [...(catalog ?? [])];
  if (selected && !options.includes(selected)) options.push(selected);
  return options;
}
