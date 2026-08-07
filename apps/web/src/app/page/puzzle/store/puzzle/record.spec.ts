import { describe, expect, it } from 'vitest';

import { blankRecord, isUntouchedRecord } from '@app/page/puzzle/store/puzzle/record';

describe('isUntouchedRecord', () => {
	it('holds for a record nothing has been written into yet', () => {
		expect(isUntouchedRecord(blankRecord())).toBe(true);
	});

	it('holds for the opponent move the board plays on its own', () => {
		expect(isUntouchedRecord({ record: ['g8h8'], explorations: [] })).toBe(true);
	});

	it('fails once a move of the player is in', () => {
		expect(isUntouchedRecord({ record: ['g8h8', 'a1a8'], explorations: [] })).toBe(false);
	});

	it('fails once the cursor has been moved', () => {
		expect(isUntouchedRecord({ record: ['g8h8', -1], explorations: [] })).toBe(false);
	});

	it('fails once free play has been entered', () => {
		const explorations = [{ at: 1, events: [] }];

		expect(isUntouchedRecord({ record: ['g8h8'], explorations })).toBe(false);
	});
});
