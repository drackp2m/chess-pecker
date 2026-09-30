import { clampToNow } from './puzzle-bookmark.util';

const NOW = new Date('2026-08-03T10:00:00.000Z');

describe('clampToNow', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('takes the server clock when the device sends no date', () => {
		expect(clampToNow()).toStrictEqual(NOW);
	});

	it('keeps a date in the past as the device sent it', () => {
		const past = new Date('2026-08-01T10:00:00.000Z');

		expect(clampToNow(past)).toBe(past);
	});

	it('keeps a date that is exactly the server clock', () => {
		const same = new Date(NOW.getTime());

		expect(clampToNow(same)).toBe(same);
	});

	it('brings a date one millisecond ahead back to the server clock', () => {
		expect(clampToNow(new Date(NOW.getTime() + 1))).toStrictEqual(NOW);
	});

	it('brings a date far in the future back to the server clock', () => {
		expect(clampToNow(new Date('2099-01-01T00:00:00.000Z'))).toStrictEqual(NOW);
	});
});
