import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduledAction } from '@app/util/scheduled-action';

describe('ScheduledAction', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('runs the action once the delay is up', () => {
		const scheduled = new ScheduledAction();
		const action = vi.fn();

		scheduled.run(action, 100);

		expect(action).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);

		expect(action).toHaveBeenCalledTimes(1);
	});

	it('runs the pending action now and leaves nothing on the clock', () => {
		const scheduled = new ScheduledAction();
		const action = vi.fn();

		scheduled.run(action, 100);
		scheduled.flush();

		expect(action).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1000);

		expect(action).toHaveBeenCalledTimes(1);
	});

	it('drains an action that schedules the next beat of the same sequence', () => {
		const scheduled = new ScheduledAction();
		const second = vi.fn();
		const first = vi.fn(() => {
			scheduled.run(second, 100);
		});

		scheduled.run(first, 100);
		scheduled.flush();

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1000);

		expect(second).toHaveBeenCalledTimes(1);
	});

	it('forgets a cancelled action instead of flushing it later', () => {
		const scheduled = new ScheduledAction();
		const action = vi.fn();

		scheduled.run(action, 100);
		scheduled.cancel();
		scheduled.flush();

		expect(action).not.toHaveBeenCalled();
	});
});
