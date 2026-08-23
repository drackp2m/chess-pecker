/** The sync lock: one only, and for the whole cycle. */
export const SYNC_LOCK = 'chesspecker-sync';

const queues = new Map<string, Promise<unknown>>();

/**
 * A critical section shared by every tab of the origin. The retry key stops the server
 * duplicating, but not the work nor the race between two responses.
 */
export async function withExclusiveLock<T>(name: string, action: () => Promise<T>): Promise<T> {
	const locks: LockManager | undefined = (navigator as Partial<Navigator>).locks;

	if (undefined === locks) {
		return runQueued(name, action);
	}

	const result: unknown = await locks.request(name, action);

	return result as T;
}

/**
 * Without `navigator.locks` — an insecure context, or a browser lacking it — this can only
 * serialise within the tab. Less than the lock promises, but the push stays idempotent.
 */
async function runQueued<T>(name: string, action: () => Promise<T>): Promise<T> {
	const previous = queues.get(name) ?? Promise.resolve();
	const next = previous.then(action, action);

	queues.set(
		name,
		next.catch(() => undefined),
	);

	return next;
}
