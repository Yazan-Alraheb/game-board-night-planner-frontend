/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import { mapSettledWithConcurrency } from "@/lib/concurrency";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("mapSettledWithConcurrency", () => {
  test("never runs more than `limit` tasks at once and keeps input order", async () => {
    let running = 0;
    let peak = 0;

    const results = await mapSettledWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return value * 10;
    });

    expect(peak).toBe(3);
    expect(results.map((result) => result.status === "fulfilled" && result.value)).toEqual([
      10, 20, 30, 40, 50, 60, 70,
    ]);
  });

  test("a failing task doesn't stop the others", async () => {
    const results = await mapSettledWithConcurrency([1, 2, 3], 2, async (value) => {
      if (value === 2) throw new Error("boom");
      return value;
    });

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  test("handles an empty list", async () => {
    expect(await mapSettledWithConcurrency([], 4, async () => 1)).toEqual([]);
  });

  test("stops starting tasks once aborted", async () => {
    const controller = new AbortController();
    const started: number[] = [];

    const promise = mapSettledWithConcurrency(
      [1, 2, 3, 4],
      1,
      async (value) => {
        started.push(value);
        if (value === 2) controller.abort();
        await tick();
        return value;
      },
      controller.signal,
    );

    await expect(promise).rejects.toBeDefined();
    expect(started).toEqual([1, 2]);
  });
});
