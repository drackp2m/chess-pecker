import type { PuzzleShareResultRequest } from '@chesspecker/api-definitions';

import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';

/**
 * ToDo => the standalone board runs no clock, so `durationMs` is left out: only a
 * training times an attempt today, and a made-up number would poison the comparison.
 */
export function puzzleShareResult(store: PuzzleStore): PuzzleShareResultRequest | undefined {
	const closure = store.closure();

	if ('open' === closure) {
		return undefined;
	}

	return {
		solved: 'solved' === store.result(),
		closure,
		hintUsed: store.hintUsed(),
		mistakeCount: store.mistakeCount(),
	};
}
