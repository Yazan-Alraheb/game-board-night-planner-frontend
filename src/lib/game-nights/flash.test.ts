/// <reference types="bun" />
import { beforeEach, describe, expect, test } from "bun:test";
import { consumeOverviewFlash, setOverviewFlash } from "@/lib/game-nights/flash";
import { installMemorySessionStorage } from "@/test-utils/memory-session-storage";

const storage = installMemorySessionStorage();

describe("overview flash message", () => {
  beforeEach(() => storage.reset());

  test("is read once", () => {
    setOverviewFlash("Strategy Night was permanently deleted.");
    expect(consumeOverviewFlash()).toBe("Strategy Night was permanently deleted.");
    expect(consumeOverviewFlash()).toBeNull();
  });

  test("is null when nothing was stored", () => {
    expect(consumeOverviewFlash()).toBeNull();
  });

  test("blocked storage never throws", () => {
    storage.setBlocked(true);
    expect(() => setOverviewFlash("x")).not.toThrow();
    expect(consumeOverviewFlash()).toBeNull();
  });

  test("long messages are capped", () => {
    setOverviewFlash("a".repeat(2000));
    expect(consumeOverviewFlash()?.length).toBe(500);
  });
});
