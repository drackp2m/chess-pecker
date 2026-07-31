import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SoundService } from '@app/service/sound.service';
import { SettingStore } from '@app/store/setting.store';

/**
 * Stands in for the real thing, blocked the way a browser blocks it before the user
 * has interacted. Firefox leaves `resume()` pending — neither resolved nor rejected —
 * for as long as that lasts, which is what these tests are about.
 */
class FakeAudioContext {
	state: 'suspended' | 'running' | 'closed' = 'suspended';
	resumeCalls = 0;
	isBlocked = true;

	readonly destination = {};

	resume(): Promise<void> {
		this.resumeCalls++;

		if (this.isBlocked) {
			return new Promise<void>(() => undefined);
		}

		this.state = 'running';

		return Promise.resolve();
	}

	close(): Promise<void> {
		this.state = 'closed';

		return Promise.resolve();
	}

	decodeAudioData(): Promise<unknown> {
		return Promise.resolve({});
	}
}

/** Lets the preload chain and every pending resume settle. */
async function flush(): Promise<void> {
	for (let index = 0; 10 > index; index++) {
		await Promise.resolve();
	}
}

describe('SoundService', () => {
	let context: FakeAudioContext;

	beforeEach(() => {
		context = new FakeAudioContext();

		vi.stubGlobal('AudioContext', function AudioContextStub(): FakeAudioContext {
			return context;
		});

		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })),
		);

		TestBed.configureTestingModule({
			providers: [
				{
					provide: SettingStore,
					useValue: { settingEntities: signal([]), isLoading: signal(false) },
				},
			],
		});
	});

	it('does not attempt a resume before any gesture has happened', async () => {
		TestBed.inject(SoundService);
		await flush();

		document.dispatchEvent(new Event('visibilitychange'));
		await flush();

		expect(context.resumeCalls).toBe(0);
		expect(context.state).toBe('suspended');
	});

	// The regression: a memoised attempt that never settles used to swallow every
	// later one, leaving the context suspended for the rest of the page's life.
	it('still resumes on a later gesture after an earlier attempt hung', async () => {
		TestBed.inject(SoundService);
		await flush();

		document.dispatchEvent(new Event('pointerdown'));
		await flush();

		expect(context.resumeCalls).toBe(1);
		expect(context.state).toBe('suspended');

		context.isBlocked = false;
		document.dispatchEvent(new Event('pointerdown'));
		await flush();

		expect(context.resumeCalls).toBe(2);
		expect(context.state).toBe('running');
	});

	it('retries on visibility once a gesture has unlocked it', async () => {
		TestBed.inject(SoundService);
		await flush();

		document.dispatchEvent(new Event('pointerdown'));
		await flush();

		context.isBlocked = false;
		document.dispatchEvent(new Event('visibilitychange'));
		await flush();

		expect(context.state).toBe('running');
	});
});
