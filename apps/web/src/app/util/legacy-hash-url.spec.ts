import { describe, expect, it, vi } from 'vitest';

import { rewriteLegacyHashUrl } from '@app/util/legacy-hash-url';

function rewrite(hash: string) {
	const history = {
		replaceState: vi.fn(
			(_state: unknown, _unused: string, _url?: string | URL | null) => undefined,
		),
	};

	rewriteLegacyHashUrl({ hash }, history);

	return history.replaceState;
}

describe('rewriteLegacyHashUrl', () => {
	it('moves a route out of the hash into the path', () => {
		expect(rewrite('#/training/solve')).toHaveBeenCalledWith(null, '', '/training/solve');
	});

	it('keeps the query string of the route', () => {
		expect(rewrite('#/puzzles?page=2')).toHaveBeenCalledWith(null, '', '/puzzles?page=2');
	});

	it('takes the bare hash root to the root', () => {
		expect(rewrite('#/')).toHaveBeenCalledWith(null, '', '/');
	});

	it('leaves a url without a hash alone', () => {
		expect(rewrite('')).not.toHaveBeenCalled();
	});

	it('leaves a hash that is not a route alone', () => {
		expect(rewrite('#top')).not.toHaveBeenCalled();
	});
});
