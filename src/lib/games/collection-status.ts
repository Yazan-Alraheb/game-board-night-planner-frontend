/**
 * Whether one game is in the signed-in user's collection, and the actions that change it,
 * for the Game Details page (/games/[id]).
 *
 * Framework-free so it can be tested without a DOM; useGameCollectionStatus subscribes to it
 * with useSyncExternalStore.
 *
 * Checked against the FastAPI schema (/openapi.json):
 * - GET    /users/{id}/collection           lists owned and wishlist games (optional ?status=).
 * - POST   /users/{id}/collection           adds a game; 409 if it is already saved.
 * - PUT    /users/{id}/collection/{game_id} switches owned <-> wishlist; 404 if not saved.
 * - DELETE /users/{id}/collection/{game_id} removes it; 404 if not saved.
 *
 * Rules:
 * - The saved status is only ever taken from the server: from the GET, or from a mutation
 *   that succeeded. A failed request never changes what is shown as saved.
 * - POST is only used for a game that isn't saved; a saved game switches with PUT.
 * - One action at a time: while one is running, further calls are ignored.
 * - Data belongs to a scope (user + game). Responses for an earlier scope are ignored.
 * - A 409 or 404 means the page was out of date (e.g. changed in another tab): the
 *   collection is fetched again so the real status is shown.
 */
import { getApiErrorInfo, type ApiErrorInfo } from "@/api/errors";
import type { CollectionGame, CollectionStatus } from "@/types/collection";

/** null = the game is not saved. */
export type SavedStatus = CollectionStatus | null;

export type MutationAction = "add-owned" | "add-wishlist" | "move-owned" | "move-wishlist" | "remove";

/** A mutation, or "refresh": re-reading the collection after a 409/404. */
export type CollectionAction = MutationAction | "refresh";

export interface CollectionNotice {
  tone: "success" | "error";
  text: string;
}

export type CollectionStatusState =
  | { status: "loading" }
  | { status: "error"; error: ApiErrorInfo }
  | {
      status: "ready";
      saved: SavedStatus;
      /** The action in flight; all controls are disabled meanwhile. */
      pending: CollectionAction | null;
      notice: CollectionNotice | null;
    };

export interface CollectionStatusSnapshot {
  scope: string | null;
  value: CollectionStatusState;
}

/** The API calls used, injectable for tests. Matches the helpers in @/api/collection. */
export interface CollectionApi {
  getCollection(userId: number, status?: CollectionStatus, signal?: AbortSignal): Promise<CollectionGame[]>;
  addToCollection(userId: number, gameId: number, status: CollectionStatus): Promise<unknown>;
  updateCollectionStatus(userId: number, gameId: number, status: CollectionStatus): Promise<unknown>;
  removeFromCollection(userId: number, gameId: number): Promise<unknown>;
}

const LOADING = { status: "loading" } as const;

export function collectionStatusScope(userId: number | null, gameId: number | null): string | null {
  return userId !== null && gameId !== null ? `${userId}:${gameId}` : null;
}

/** What to render for `scope`: state stored for any other scope reads as loading. */
export function readCollectionStatus(
  snapshot: CollectionStatusSnapshot,
  scope: string | null,
): CollectionStatusState {
  return scope !== null && snapshot.scope === scope ? snapshot.value : LOADING;
}

export function findSavedStatus(entries: readonly CollectionGame[], gameId: number): SavedStatus {
  return entries.find((entry) => entry.game.id === gameId)?.status ?? null;
}

/** The action that moves a game from `saved` to `target`, or null when nothing would change. */
export function actionFor(saved: SavedStatus, target: CollectionStatus): MutationAction | null {
  if (saved === target) return null;
  if (saved === null) return target === "owned" ? "add-owned" : "add-wishlist";
  return target === "owned" ? "move-owned" : "move-wishlist";
}

const SUCCESS_TEXT: Record<MutationAction, string> = {
  "add-owned": "Added to your collection.",
  "add-wishlist": "Added to your wishlist.",
  "move-owned": "Moved to your collection.",
  "move-wishlist": "Moved to your wishlist.",
  remove: "Removed from your collection.",
};

const FAILURE_TEXT: Record<MutationAction, string> = {
  "add-owned": "Could not add this game to your collection. Please try again.",
  "add-wishlist": "Could not add this game to your wishlist. Please try again.",
  "move-owned": "Could not move this game to your collection. Please try again.",
  "move-wishlist": "Could not move this game to your wishlist. Please try again.",
  remove: "Could not remove this game. Please try again.",
};

const OUT_OF_DATE_TEXT = "This game was changed somewhere else. Showing its current status.";

export class GameCollectionStatus {
  private snapshot: CollectionStatusSnapshot = { scope: null, value: LOADING };
  private readonly listeners = new Set<() => void>();

  private scope: string | null = null;
  private userId: number | null = null;
  private gameId: number | null = null;
  private controller: AbortController | null = null;
  /** Bumped on every open/close, so work started for an earlier scope can't write. */
  private epoch = 0;

  constructor(private readonly api: CollectionApi) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): CollectionStatusSnapshot => this.snapshot;

  /** Starts serving `scope`; anything from the previous scope is aborted and ignored. */
  open(scope: string, userId: number, gameId: number): void {
    this.close();
    this.scope = scope;
    this.userId = userId;
    this.gameId = gameId;
    void this.fetch(null);
  }

  /** Stops serving the current scope (unmount, sign-out, user or game change). */
  close(): void {
    this.controller?.abort();
    this.controller = null;
    this.scope = null;
    this.userId = null;
    this.gameId = null;
    this.epoch++;
  }

  /** Loads again after an error (the Retry button). Ignored otherwise, so no duplicate GET. */
  retry(): Promise<void> {
    if (this.current()?.status !== "error") return Promise.resolve();
    return this.fetch(null);
  }

  /** Saves the game as `target`: POST when it isn't saved yet, PUT when switching. */
  save(target: CollectionStatus): Promise<void> {
    const value = this.current();
    if (value?.status !== "ready" || value.pending !== null) return Promise.resolve();

    const action = actionFor(value.saved, target);
    if (action === null) return Promise.resolve();

    return this.mutate(action, value.saved, target, (userId, gameId) =>
      value.saved === null
        ? this.api.addToCollection(userId, gameId, target)
        : this.api.updateCollectionStatus(userId, gameId, target),
    );
  }

  /** Removes the game from the collection or wishlist. */
  remove(): Promise<void> {
    const value = this.current();
    if (value?.status !== "ready" || value.pending !== null || value.saved === null) {
      return Promise.resolve();
    }
    return this.mutate("remove", value.saved, null, (userId, gameId) =>
      this.api.removeFromCollection(userId, gameId),
    );
  }

  /** The state for the open scope, or null when nothing is open. */
  private current(): CollectionStatusState | null {
    const { scope, snapshot } = this;
    return scope !== null && snapshot.scope === scope ? snapshot.value : scope !== null ? LOADING : null;
  }

  private async mutate(
    action: MutationAction,
    saved: SavedStatus,
    next: SavedStatus,
    request: (userId: number, gameId: number) => Promise<unknown>,
  ): Promise<void> {
    const { scope, userId, gameId, epoch } = this;
    if (scope === null || userId === null || gameId === null) return;

    this.write(scope, { status: "ready", saved, pending: action, notice: null });

    try {
      await request(userId, gameId);
    } catch (error: unknown) {
      if (epoch !== this.epoch) return;
      const info = getApiErrorInfo(error);

      if (info.kind === "conflict" || info.kind === "not_found") {
        // The page was out of date. Ask the server instead of guessing.
        return this.fetch({ tone: "error", text: OUT_OF_DATE_TEXT });
      }

      this.write(scope, {
        status: "ready",
        saved,
        pending: null,
        notice: { tone: "error", text: FAILURE_TEXT[action] },
      });
      return;
    }

    if (epoch !== this.epoch) return;
    this.write(scope, {
      status: "ready",
      saved: next,
      pending: null,
      notice: { tone: "success", text: SUCCESS_TEXT[action] },
    });
  }

  /**
   * Fetches the collection. Without a notice this shows the loading state; with one
   * (after a 409/404) the controls stay disabled and the notice is shown with the result.
   * A failure shows the error state, never a guessed saved status.
   */
  private async fetch(notice: CollectionNotice | null): Promise<void> {
    const { scope, userId, gameId } = this;
    if (scope === null || userId === null || gameId === null) return;

    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;

    const previous = this.snapshot.scope === scope ? this.snapshot.value : null;
    if (notice !== null && previous?.status === "ready") {
      this.write(scope, { ...previous, pending: "refresh" });
    } else {
      this.write(scope, LOADING);
    }

    try {
      const entries = await this.api.getCollection(userId, undefined, controller.signal);
      if (controller !== this.controller) return;
      this.write(scope, {
        status: "ready",
        saved: findSavedStatus(entries, gameId),
        pending: null,
        notice,
      });
    } catch (error: unknown) {
      if (controller !== this.controller) return;
      const info = getApiErrorInfo(error);
      if (info.kind === "canceled") return;
      this.write(scope, { status: "error", error: info });
    }
  }

  private write(scope: string, value: CollectionStatusState): void {
    this.snapshot = { scope, value };
    for (const listener of this.listeners) listener();
  }
}
