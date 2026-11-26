/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import type { ApiErrorInfo } from "@/api/errors";
import { resolveUserResource, userRequestKey, type KeyedResult } from "@/lib/user-resource";

const networkError: ApiErrorInfo = { kind: "network", status: null, detail: null };

describe("userRequestKey", () => {
  test("is null when nobody is signed in", () => {
    expect(userRequestKey(null, null, 0)).toBeNull();
    expect(userRequestKey(1, null, 0)).toBeNull();
    expect(userRequestKey(null, "token", 0)).toBeNull();
  });

  test("changes with the user, the session token and each retry", () => {
    const base = userRequestKey(1, "token-a", 0);
    expect(userRequestKey(2, "token-a", 0)).not.toBe(base);
    expect(userRequestKey(1, "token-b", 0)).not.toBe(base);
    expect(userRequestKey(1, "token-a", 1)).not.toBe(base);
    expect(userRequestKey(1, "token-a", 0)).toBe(base);
  });
});

describe("resolveUserResource", () => {
  const key = userRequestKey(1, "token-a", 0);
  const success: KeyedResult<string[]> = { key: key!, value: { status: "success", data: ["night"] } };

  test("is loading until the auth state is known", () => {
    expect(resolveUserResource(false, null, null)).toEqual({ status: "loading" });
    expect(resolveUserResource(false, key, success)).toEqual({ status: "loading" });
  });

  test("is signed-out when ready without a session, ignoring any old result", () => {
    expect(resolveUserResource(true, null, success)).toEqual({ status: "signed-out" });
  });

  test("is loading while the current request has no result yet", () => {
    expect(resolveUserResource(true, key, null)).toEqual({ status: "loading" });
  });

  test("returns the result of the current request (success, including empty data)", () => {
    expect(resolveUserResource(true, key, success)).toEqual({ status: "success", data: ["night"] });
    const empty: KeyedResult<string[]> = { key: key!, value: { status: "success", data: [] } };
    expect(resolveUserResource(true, key, empty)).toEqual({ status: "success", data: [] });
  });

  test("returns a failure of the current request", () => {
    const failed: KeyedResult<string[]> = { key: key!, value: { status: "error", error: networkError } };
    expect(resolveUserResource(true, key, failed)).toEqual({ status: "error", error: networkError });
  });

  test("never shows stale data from another user, session or attempt", () => {
    expect(resolveUserResource(true, userRequestKey(2, "token-z", 0), success)).toEqual({ status: "loading" });
    expect(resolveUserResource(true, userRequestKey(1, "token-b", 0), success)).toEqual({ status: "loading" });
    expect(resolveUserResource(true, userRequestKey(1, "token-a", 1), success)).toEqual({ status: "loading" });
  });
});
