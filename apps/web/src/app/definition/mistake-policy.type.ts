export interface MistakePolicy {
	readonly undoMistake: boolean;
	readonly freePlay: boolean;
	readonly retry: boolean;
	readonly showSolution: boolean;
}

export type MistakePolicyKey = keyof MistakePolicy;

export const DEFAULT_MISTAKE_POLICY: MistakePolicy = {
	undoMistake: false,
	freePlay: true,
	retry: true,
	showSolution: true,
};

export const MISTAKE_POLICY_LABEL: Record<MistakePolicyKey, string> = {
	undoMistake: 'Take the wrong move back for me',
	freePlay: 'Let me play on from the wrong move, both sides by hand',
	retry: 'Let me keep solving the exercise after a miss',
	showSolution: 'Offer a button that plays the solution',
};

function readFlag(value: unknown, fallback: boolean): boolean {
	return 'boolean' === typeof value ? value : fallback;
}

export function normalizeMistakePolicy(value: unknown): MistakePolicy {
	if (null === value || 'object' !== typeof value) {
		return DEFAULT_MISTAKE_POLICY;
	}

	const stored = value as Partial<Record<MistakePolicyKey, unknown>>;

	return {
		undoMistake: readFlag(stored.undoMistake, DEFAULT_MISTAKE_POLICY.undoMistake),
		freePlay: readFlag(stored.freePlay, DEFAULT_MISTAKE_POLICY.freePlay),
		retry: readFlag(stored.retry, DEFAULT_MISTAKE_POLICY.retry),
		showSolution: readFlag(stored.showSolution, DEFAULT_MISTAKE_POLICY.showSolution),
	};
}
