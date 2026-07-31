export interface MistakePolicy {
	readonly mistakesBeforeSolution: number;
}

export interface MistakeThresholdOption {
	readonly value: number;
	readonly label: string;
}

export const MISTAKE_THRESHOLD_OPTIONS: readonly MistakeThresholdOption[] = [
	{ value: 0, label: 'Never' },
	{ value: 1, label: 'After one miss' },
	{ value: 2, label: 'After two misses' },
	{ value: 3, label: 'After three misses' },
];

export const DEFAULT_MISTAKE_POLICY: MistakePolicy = { mistakesBeforeSolution: 2 };

function readThreshold(value: unknown): number {
	return MISTAKE_THRESHOLD_OPTIONS.some((option) => option.value === value)
		? (value as number)
		: DEFAULT_MISTAKE_POLICY.mistakesBeforeSolution;
}

export function normalizeMistakePolicy(value: unknown): MistakePolicy {
	if (null === value || 'object' !== typeof value) {
		return DEFAULT_MISTAKE_POLICY;
	}

	const stored = value as Partial<Record<keyof MistakePolicy, unknown>>;

	return { mistakesBeforeSolution: readThreshold(stored.mistakesBeforeSolution) };
}
