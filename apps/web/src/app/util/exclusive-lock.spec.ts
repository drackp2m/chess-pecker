import { describe, expect, it } from 'vitest';

import { withExclusiveLock } from '@app/util/exclusive-lock';

interface Gate {
	readonly promise: Promise<void>;
	readonly open: () => void;
}

function gate(): Gate {
	let open: () => void = () => undefined;
	const promise = new Promise<void>((resolve) => {
		open = resolve;
	});

	return {
		promise,
		open: () => {
			open();
		},
	};
}

function nextTask(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, 0);
	});
}

describe('withExclusiveLock, on the queue that stands in for navigator.locks', () => {
	it('runs one at a time under the same name', async () => {
		const order: string[] = [];
		const first = gate();
		const running = withExclusiveLock('same-name', async () => {
			order.push('first in');
			await first.promise;
			order.push('first out');
		});
		const waiting = withExclusiveLock('same-name', () => {
			order.push('second in');

			return Promise.resolve();
		});

		await nextTask();

		expect(order).toEqual(['first in']);

		first.open();
		await Promise.all([running, waiting]);

		expect(order).toEqual(['first in', 'first out', 'second in']);
	});

	it('does not make different names wait for each other', async () => {
		const held = gate();

		void withExclusiveLock('held-name', () => held.promise);

		await expect(withExclusiveLock('free-name', () => Promise.resolve('through'))).resolves.toBe(
			'through',
		);

		held.open();
	});

	it('lets the next one through when the previous throws', async () => {
		await expect(
			withExclusiveLock('failing-name', () => Promise.reject(new Error('the pass blew up'))),
		).rejects.toThrow('the pass blew up');

		await expect(withExclusiveLock('failing-name', () => Promise.resolve('next'))).resolves.toBe(
			'next',
		);
	});
});
