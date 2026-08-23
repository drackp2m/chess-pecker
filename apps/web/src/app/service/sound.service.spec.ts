import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SoundService } from '@app/service/sound.service';
import { SettingStore } from '@app/store/setting.store';

/**
 * Stands in for the real thing, blocked as a browser blocks it before any interaction.
 * `state` is widened past the standard union because WebKit reports `interrupted` too.
 */
class FakeAudioContext {
	state: 'suspended' | 'running' | 'closed' | 'interrupted' = 'suspended';
	currentTime = 0;
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
}

/** Decoding never touches an output device, so it has its own stub. */
class FakeOfflineAudioContext {
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
	let contexts: FakeAudioContext[];
	let now: number;

	/** The context the service is playing through, i.e. the one built last. */
	function latest(): FakeAudioContext {
		const context = contexts.at(-1);

		if (undefined === context) {
			throw new Error('no context was built');
		}

		return context;
	}

	async function gesture(): Promise<void> {
		document.dispatchEvent(new Event('pointerdown'));
		await flush();
	}

	/**
	 * Leaves the service on a running context whose clock has already been read once,
	 * which is what the staleness check compares against.
	 */
	async function settled(): Promise<void> {
		await gesture();

		latest().isBlocked = false;

		await gesture();
		await gesture();
	}

	beforeEach(() => {
		contexts = [];
		now = 0;

		vi.spyOn(performance, 'now').mockImplementation(() => now);

		vi.stubGlobal('AudioContext', function AudioContextStub(): FakeAudioContext {
			const context = new FakeAudioContext();

			contexts.push(context);

			return context;
		});

		vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext);

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

	// The regression this file exists for: WebKit poisons a context interrupted before it
	// ever ran, and keeps the poison across reloads.
	it('opens no context until a gesture happens', async () => {
		TestBed.inject(SoundService);
		await flush();

		window.dispatchEvent(new Event('visibilitychange'));
		await flush();

		expect(contexts).toHaveLength(0);
	});

	it('opens the context on the first gesture and resumes it', async () => {
		TestBed.inject(SoundService);
		await flush();

		await gesture();

		expect(contexts).toHaveLength(1);
		expect(latest().resumeCalls).toBe(1);
	});

	// A memoised attempt that never settles used to swallow every later one, leaving
	// the context suspended for the rest of the page's life.
	it('still resumes on a later gesture after an earlier attempt hung', async () => {
		TestBed.inject(SoundService);
		await flush();

		await gesture();

		expect(latest().state).toBe('suspended');

		latest().isBlocked = false;
		await gesture();

		expect(contexts).toHaveLength(1);
		expect(latest().resumeCalls).toBe(2);
		expect(latest().state).toBe('running');
	});

	it('retries on a wake once a gesture has opened the context', async () => {
		TestBed.inject(SoundService);
		await flush();

		await gesture();
		latest().isBlocked = false;

		window.dispatchEvent(new Event('visibilitychange'));
		await flush();

		expect(latest().state).toBe('running');
	});

	it('keeps a context whose clock is still advancing', async () => {
		TestBed.inject(SoundService);
		await flush();

		await settled();

		now += 1000;
		latest().currentTime += 1;
		await gesture();

		expect(contexts).toHaveLength(1);
		expect(latest().state).toBe('running');
	});

	// A poisoned context reports `running` and plays nothing; the stopped clock is the
	// only tell, and a gesture is the only moment a replacement can be born healthy.
	it('replaces a running context whose clock has stopped', async () => {
		TestBed.inject(SoundService);
		await flush();

		await settled();

		const poisoned = latest();

		now += 1000;
		await gesture();

		expect(contexts).toHaveLength(2);
		expect(poisoned.state).toBe('closed');
	});

	it('replaces a context WebKit reports as interrupted', async () => {
		TestBed.inject(SoundService);
		await flush();

		await gesture();

		const interrupted = latest();

		interrupted.state = 'interrupted';
		await gesture();

		expect(contexts).toHaveLength(2);
		expect(interrupted.state).toBe('closed');
	});
});
