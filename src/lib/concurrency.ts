/**
 * Like `Promise.allSettled(items.map(task))`, but runs at most `limit` tasks at once.
 * Results keep the order of `items`. Once `signal` is aborted no new tasks start;
 * the returned promise then rejects with the abort reason.
 */
export async function mapSettledWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      signal?.throwIfAborted();
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  signal?.throwIfAborted();

  return results;
}
