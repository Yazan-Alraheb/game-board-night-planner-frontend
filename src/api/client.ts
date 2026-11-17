import axios from "axios";
import {
  getSession,
  clearSession,
  AUTH_INVALIDATED_EVENT,
} from "@/auth/session";

const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT to protected API requests.
api.interceptors.request.use((config) => {
  const session = getSession();

  if (session && !config.url?.startsWith("/auth/")) {
    config.headers.set(
      "Authorization",
      `Bearer ${session.access_token}`
    );
  }

  return config;
});

// Handle tokens rejected by FastAPI
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const authorization = error.config?.headers?.get("Authorization");
      const session = getSession();

      // Only invalidate the session that actually made
      // this request. Don't log out a newer session.
      if (
        session &&
        authorization === `Bearer ${session.access_token}`
      ) {
        clearSession();
        window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT));
      }
    }

    return Promise.reject(error);
  }
);

export default api;
