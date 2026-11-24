import axios from "axios";

/**
 * Safe helpers for API errors.
 *
 * Never log the Axios error object: its `config` holds the Authorization header.
 * Use these helpers to read only the HTTP status and the backend's `detail` text.
 */

export type ApiErrorKind =
  | "unauthorized" // 401: missing or expired login
  | "forbidden" // 403
  | "not_found" // 404
  | "conflict" // 409
  | "validation" // 422
  | "bad_request" // 400
  | "network" // no response (server down, timeout, offline)
  | "canceled" // the request was aborted on purpose
  | "server" // 5xx or unexpected status
  | "unknown";

export interface ApiErrorInfo {
  kind: ApiErrorKind;
  status: number | null;
  /** Backend `detail` text when it is a plain string; validation arrays are not exposed. */
  detail: string | null;
}

export function getApiErrorInfo(error: unknown): ApiErrorInfo {
  if (axios.isCancel(error)) {
    return { kind: "canceled", status: null, detail: null };
  }

  if (!axios.isAxiosError(error)) {
    return { kind: "unknown", status: null, detail: null };
  }

  if (error.code === "ERR_CANCELED") {
    return { kind: "canceled", status: null, detail: null };
  }

  const status = error.response?.status ?? null;
  const data: unknown = error.response?.data;
  const detail =
    data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
      ? data.detail
      : null;

  if (status === null) return { kind: "network", status, detail };

  const kindByStatus: Record<number, ApiErrorKind> = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation",
  };

  return { kind: kindByStatus[status] ?? "server", status, detail };
}
