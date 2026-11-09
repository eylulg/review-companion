type Settled<T, R> = { item: T; index: number; ok: true; value: R } | { item: T; index: number; ok: false; error: unknown };

/**
 * Runs `worker` over `items` with at most `limit` in flight and yields each result as soon as it
 * settles, so callers can stream results in completion order. `onStart` fires as each item starts.
 */
export async function* mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
    onStart?: (item: T, index: number) => void,
): AsyncGenerator<Settled<T, R>> {
    const inflight = new Map<number, Promise<Settled<T, R>>>();
    let next = 0;

    const launch = (item: T) => {
        const index = next;
        next += 1;
        onStart?.(item, index);
        inflight.set(
            index,
            worker(item, index).then(
                (value): Settled<T, R> => ({ item, index, ok: true, value }),
                (error: unknown): Settled<T, R> => ({ item, index, ok: false, error }),
            ),
        );
    };

    const launchNext = () => {
        const item = items[next];
        if (next < items.length && item !== undefined) launch(item);
    };

    while (next < items.length && inflight.size < Math.max(1, limit)) launchNext();

    while (inflight.size > 0) {
        const settled = await Promise.race(inflight.values());
        inflight.delete(settled.index);
        launchNext();
        yield settled;
    }
}
