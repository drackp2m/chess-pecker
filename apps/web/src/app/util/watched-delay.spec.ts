import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchedDelay } from '@app/util/watched-delay';

describe('WatchedDelay', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('runs the action once the delay is up', () => {
		const delay = new WatchedDelay();
		const action = vi.fn();

		delay.start(100, action);
		vi.advanceTimersByTime(99);

		expect(action).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);

		expect(action).toHaveBeenCalledTimes(1);
	});

	it('counts no time at all while it is paused', () => {
		const delay = new WatchedDelay();
		const action = vi.fn();

		delay.start(100, action);
		vi.advanceTimersByTime(60);
		delay.pause();
		vi.advanceTimersByTime(10_000);

		expect(action).not.toHaveBeenCalled();

		delay.resume();
		vi.advanceTimersByTime(39);

		expect(action).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);

		expect(action).toHaveBeenCalledTimes(1);
	});

	it('takes the second pause and the second resume for the same one', () => {
		const delay = new WatchedDelay();
		const action = vi.fn();

		delay.start(100, action);
		vi.advanceTimersByTime(60);
		delay.pause();
		delay.pause();
		vi.advanceTimersByTime(1000);
		delay.resume();
		delay.resume();
		vi.advanceTimersByTime(40);

		expect(action).toHaveBeenCalledTimes(1);
	});

	it('has nothing to pick up once it has run, or before it is started', () => {
		const delay = new WatchedDelay();
		const action = vi.fn();

		delay.resume();
		delay.start(100, action);
		vi.advanceTimersByTime(100);
		delay.resume();
		vi.advanceTimersByTime(1000);

		expect(action).toHaveBeenCalledTimes(1);
	});

	it('drops what it was told to do when it is cancelled or started over', () => {
		const delay = new WatchedDelay();
		const dropped = vi.fn();
		const action = vi.fn();

		delay.start(100, dropped);
		vi.advanceTimersByTime(90);
		delay.start(100, action);
		vi.advanceTimersByTime(100);

		expect(dropped).not.toHaveBeenCalled();
		expect(action).toHaveBeenCalledTimes(1);

		delay.start(100, dropped);
		delay.cancel();
		vi.advanceTimersByTime(1000);

		expect(dropped).not.toHaveBeenCalled();
	});
});
