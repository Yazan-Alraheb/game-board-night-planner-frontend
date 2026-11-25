"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiErrorInfo, type ApiErrorInfo } from "@/api/errors";
import { getRecommendations } from "@/api/recommendations";
import {
  loadSubmittedRequest,
  type SubmittedRequestSnapshot,
} from "@/lib/find-game/submitted-request";
import { loadCachedResults, saveCachedResults } from "@/lib/recommendations/results-cache";
import type { Recommendation } from "@/types/recommendation";

export type RecommendationsState =
  /** No usable submitted request: the user must answer the questionnaire first. */
  | { status: "no-request"; reason: "missing" | "stale" | "invalid" }
  | { status: "loading"; snapshot: SubmittedRequestSnapshot }
  | { status: "success"; snapshot: SubmittedRequestSnapshot; recommendations: Recommendation[] }
  | { status: "error"; snapshot: SubmittedRequestSnapshot; error: ApiErrorInfo };

function initialState(userId: number): RecommendationsState {
  const loaded = loadSubmittedRequest(userId);
  if (loaded.status !== "ok") return { status: "no-request", reason: loaded.status };

  const cached = loadCachedResults(loaded.snapshot);
  return cached
    ? { status: "success", snapshot: loaded.snapshot, recommendations: cached }
    : { status: "loading", snapshot: loaded.snapshot };
}

/**
 * Loads recommendations for the user's submitted request.
 *
 * 1. Reads the submitted snapshot. Without one, nothing is requested.
 * 2. Reuses cached results for that exact submission (e.g. after a refresh).
 * 3. Otherwise sends one POST /api/recommendations and caches the result.
 *
 * Errors are returned as they are. There are never fallback or mock results.
 */
export function useRecommendations(userId: number): {
  state: RecommendationsState;
  retry: () => void;
} {
  const [state, setState] = useState<RecommendationsState>(() => initialState(userId));

  useEffect(() => {
    if (state.status !== "loading") return;

    const { snapshot } = state;
    const controller = new AbortController();

    getRecommendations(snapshot.request, controller.signal)
      .then((recommendations) => {
        saveCachedResults(snapshot, recommendations);
        setState({ status: "success", snapshot, recommendations });
      })
      .catch((error: unknown) => {
        const info = getApiErrorInfo(error);
        if (info.kind === "canceled" || controller.signal.aborted) return;
        setState({ status: "error", snapshot, error: info });
      });

    return () => controller.abort();
  }, [state]);

  const retry = useCallback(() => {
    setState((current) =>
      current.status === "error" ? { status: "loading", snapshot: current.snapshot } : current,
    );
  }, []);

  return { state, retry };
}
