export const SyncPolicy = {
	/**
	 * Pending rows per request. A veteran account's tree is thousands, so the overflow waits
	 * for the next pass — harmless, since the push is idempotent.
	 */
	pushBatchSize: 200,

	pushBatchBytes: 512 * 1024,

	rowBytes: 320,

	/** Requests per pass, so a tree that makes no progress cannot spin forever. */
	maxRequestsPerRun: 50,

	/** The wait before each retry, in order: its length decides how many there are. */
	retryBackoffMs: [1000, 4000],

	/** Boot's hard cap: past this the gate opens, successfully or not. */
	startupTimeoutMs: 15000,

	/**
	 * How long the splash waits — watched, not backgrounded — before saying what is going on.
	 * A pass that ends sooner is a flicker, and a flicker should show nothing.
	 */
	splashDetailMs: 600,

	/**
	 * How often it re-syncs on coming back to the app or regaining the network. Without this
	 * floor, switching tabs would fire a pass per switch.
	 */
	revisitAfterMs: 5 * 60 * 1000,

	cutBackoffMs: [30 * 1000, 60 * 1000, 2 * 60 * 1000, 5 * 60 * 1000],

	/** Past this a row has been waiting too long, and it has to be said. */
	staleAfterMs: 7 * 24 * 60 * 60 * 1000,

	/**
	 * How many refusal reasons are kept per table to show. The count covers them all; the list
	 * is a sample, since whoever reads it wants the pattern and not the inventory.
	 */
	rejectionSampleSize: 5,
} as const;
