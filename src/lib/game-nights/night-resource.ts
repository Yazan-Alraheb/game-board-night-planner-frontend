/**
 * Request bookkeeping for one resource of a game night (the event, its members or its games).
 *
 * Framework-free so the race handling can be tested without a DOM; useGameNightDetails
 * subscribes to it with useSyncExternalStore.
 *
 * Rules:
 * - Data belongs to a scope (signed-in user + night id). Data from another scope is never
 *   shown, and requests started for another scope can never write.
 * - Only the newest request may write. A server-confirmed local change (`update`) or a
 *   forced error (`fail`) also counts as newer, so a GET that started earlier can't undo it.
 * - When `update` drops a GET that was still running, it fetches again quietly, so server
 *   changes that GET would have brought aren't lost.
 */
import { getApiErrorInfo, type ApiErrorInfo } from "@/api/errors";

export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiErrorInfo }
  | { status: "success"; data: T };

export interface ResourceSnapshot<T> {
  scope: string | null;
  value: Resource<T>;
}

/**
 * When `update` fetches the resource again afterwards:
 * - "if-dropped" (default): only when a GET was still running and had to be ignored.
 * - "always": the change may affect other server data, so always re-check quietly.
 * - "never": the new data is the server's complete answer, nothing to re-check.
 */
export type UpdateRefetch = "if-dropped" | "always" | "never";

export type NightFetcher<T> = (nightId: number, signal: AbortSignal) => Promise<T>;

const LOADING = { status: "loading" } as const;

/** Identifies whose data for which night is loaded; null when either is unknown. */
export function nightResourceScope(userId: number | null, nightId: number | null): string | null {
  return userId !== null && nightId !== null ? `${userId}:${nightId}` : null;
}

/** What to render for `scope`: data stored for any other scope reads as loading. */
export function readNightResource<T>(snapshot: ResourceSnapshot<T>, scope: string | null): Resource<T> {
  return scope !== null && snapshot.scope === scope ? snapshot.value : LOADING;
}

export class NightResource<T> {
  private snapshot: ResourceSnapshot<T> = { scope: null, value: LOADING };
  private readonly listeners = new Set<() => void>();

  private scope: string | null = null;
  private nightId: number | null = null;
  private controller: AbortController | null = null;

  /** Id of the newest request; only it may write. Bumped to invalidate everything older. */
  private latest = 0;
  /** Requests still waiting for a response. */
  private readonly running = new Set<number>();

  constructor(private readonly fetcher: NightFetcher<T>) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ResourceSnapshot<T> => this.snapshot;

  /** Starts serving `scope`: everything from the previous scope is aborted and ignored. */
  open(scope: string, nightId: number): void {
    this.close();
    this.scope = scope;
    this.nightId = nightId;
    this.controller = new AbortController();
    void this.fetchLatest(false);
  }

  /** Stops serving the current scope (unmount, sign-out, user or night change). */
  close(): void {
    this.controller?.abort();
    this.controller = null;
    this.scope = null;
    this.nightId = null;
    this.latest++;
    this.running.clear();
  }

  /** Reloads. Without `quiet` the loading state is shown meanwhile (a Retry button). */
  load(scope: string | null, quiet = false): Promise<void> {
    if (!this.isCurrent(scope)) return Promise.resolve();
    if (!quiet) this.write(scope, LOADING);
    return this.fetchLatest(quiet);
  }

  /** Applies a server-confirmed change to loaded data. */
  update(scope: string | null, change: (data: T) => T, refetch: UpdateRefetch = "if-dropped"): void {
    if (!this.isCurrent(scope)) return;

    // Any GET still running started before this change was confirmed: it may no longer write.
    const droppedRequest = this.running.has(this.latest);
    this.latest++;

    const current = this.snapshot;
    if (current.scope === scope && current.value.status === "success") {
      this.write(scope, { status: "success", data: change(current.value.data) });
    }

    if (refetch === "always" || (refetch === "if-dropped" && droppedRequest)) {
      void this.fetchLatest(true);
    }
  }

  /** Shows an error (e.g. the night is gone) and drops any response still on its way. */
  fail(scope: string | null, error: ApiErrorInfo): void {
    if (!this.isCurrent(scope)) return;
    this.latest++;
    this.write(scope, { status: "error", error });
  }

  /** Number of requests still waiting for a response (for tests and debugging). */
  get pendingRequests(): number {
    return this.running.size;
  }

  private isCurrent(scope: string | null): scope is string {
    return scope !== null && scope === this.scope;
  }

  /**
   * Fetches and stores the result if this is still the newest request.
   * With `quiet`, a failure keeps data already shown (except when the night is gone);
   * without data to keep, the error is shown so the page never stays on "loading".
   */
  private async fetchLatest(quiet: boolean): Promise<void> {
    const { scope, nightId, controller } = this;
    if (scope === null || nightId === null || controller === null) return;

    const requestId = ++this.latest;
    this.running.add(requestId);

    try {
      const data = await this.fetcher(nightId, controller.signal);
      if (requestId === this.latest) this.write(scope, { status: "success", data });
    } catch (error: unknown) {
      if (requestId !== this.latest) return;
      const info = getApiErrorInfo(error);
      if (info.kind === "canceled") return;

      const hasData = this.snapshot.scope === scope && this.snapshot.value.status === "success";
      if (quiet && hasData && info.kind !== "not_found") return;

      this.write(scope, { status: "error", error: info });
    } finally {
      this.running.delete(requestId);
    }
  }

  private write(scope: string, value: Resource<T>): void {
    this.snapshot = { scope, value };
    for (const listener of this.listeners) listener();
  }
}
