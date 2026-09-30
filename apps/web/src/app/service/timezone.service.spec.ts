import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Setting } from '@app/model/setting.model';
import {
	DEFAULT_TIMEZONE,
	TIMEZONES,
	TimezoneService,
	normalizeTimezone,
} from '@app/service/timezone.service';
import { SettingStore } from '@app/store/setting.store';
import { zoneDayLabel } from '@app/util/timezone-date';

const KYIV = ['Europe/Kiev', 'Europe/Kyiv'];
const KOLKATA = ['Asia/Calcutta', 'Asia/Kolkata'];

function timezoneSetting(payload: unknown): Setting {
	return new Setting({ type: 'TIMEZONE', payload: payload as never });
}

function configure(settings: readonly Setting[] = [], isLoading = false) {
	const store = {
		settingEntities: signal(settings),
		isLoading: signal(isLoading),
		save: vi.fn<(item: Setting) => void>(),
	};

	TestBed.configureTestingModule({
		providers: [{ provide: SettingStore, useValue: store }],
	});

	const service = TestBed.inject(TimezoneService);

	TestBed.tick();

	return { service, store };
}

function lastSaved({ store }: ReturnType<typeof configure>): Setting {
	const saved = store.save.mock.calls.at(-1)?.[0];

	if (undefined === saved) {
		throw new Error('No setting was saved');
	}

	return saved;
}

describe('normalizeTimezone', () => {
	it('keeps every zone the selector offers', () => {
		for (const timezone of TIMEZONES) {
			expect(normalizeTimezone(timezone)).toBe(timezone);
		}
	});

	it('keeps a renamed zone under either of its names', () => {
		for (const name of KYIV) {
			expect(KYIV).toContain(normalizeTimezone(name));
		}

		for (const name of KOLKATA) {
			expect(KOLKATA).toContain(normalizeTimezone(name));
		}
	});

	it('resolves a legacy link to a zone on the same clock', () => {
		const pacific = new Date('2026-09-02T00:30:00.000Z');
		const kyiv = new Date('2026-09-01T21:30:00.000Z');

		expect(zoneDayLabel(pacific, normalizeTimezone('US/Pacific'))).toBe('2026-09-01');
		expect(zoneDayLabel(kyiv, normalizeTimezone('Europe/Kiev'))).toBe('2026-09-02');
	});

	it('returns the canonical spelling whatever the case of the stored value', () => {
		expect(normalizeTimezone('europe/madrid')).toBe('Europe/Madrid');
		expect(normalizeTimezone('AMERICA/LOS_ANGELES')).toBe('America/Los_Angeles');
		expect(TIMEZONES).toContain(normalizeTimezone('europe/madrid'));
	});

	it('falls back to the device zone for any value that is not a string', () => {
		for (const value of [undefined, null, 42, true, {}, ['Europe/Madrid'], new Date()]) {
			expect(normalizeTimezone(value)).toBe(DEFAULT_TIMEZONE);
		}
	});

	it('falls back to the device zone for a string Intl does not accept', () => {
		for (const value of [
			'',
			' Europe/Madrid',
			'Europe/Madrid ',
			'Europe',
			'Mars/Olympus_Mons',
			'America/Los_Angeles/Extra',
			'Europe/Madrid; DROP TABLE setting',
		]) {
			expect(normalizeTimezone(value)).toBe(DEFAULT_TIMEZONE);
		}
	});

	it('is stable when applied to its own output', () => {
		const values = ['Europe/Kiev', 'Asia/Kolkata', 'europe/madrid', 'US/Pacific', 'Mars/X', 7];

		for (const value of values) {
			const once = normalizeTimezone(value);

			expect(normalizeTimezone(once)).toBe(once);
		}
	});
});

describe('TimezoneService', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('starts on the device zone when no zone was stored', () => {
		const { service } = configure();

		expect(service.selectedTimezone()).toBe(DEFAULT_TIMEZONE);
	});

	it('applies a stored zone under its old name instead of dropping it', () => {
		const { service } = configure([timezoneSetting('Europe/Kiev')]);

		expect(KYIV).toContain(service.selectedTimezone());
	});

	it('applies a stored zone saved with the wrong case', () => {
		const { service } = configure([timezoneSetting('asia/tokyo')]);

		expect(service.selectedTimezone()).toBe('Asia/Tokyo');
	});

	it('falls back to the device zone when the stored payload is not a zone', () => {
		const { service } = configure([timezoneSetting('Mars/Olympus_Mons')]);

		expect(service.selectedTimezone()).toBe(DEFAULT_TIMEZONE);
	});

	it('falls back to the device zone when the stored payload is not even a string', () => {
		const { service } = configure([timezoneSetting(42)]);

		expect(service.selectedTimezone()).toBe(DEFAULT_TIMEZONE);
	});

	it('waits for the settings to load before applying the stored zone', () => {
		const { service, store } = configure([timezoneSetting('Asia/Tokyo')], true);

		expect(service.selectedTimezone()).toBe(DEFAULT_TIMEZONE);

		store.isLoading.set(false);
		TestBed.tick();

		expect(service.selectedTimezone()).toBe('Asia/Tokyo');
	});

	it('selects and saves the canonical spelling of the chosen zone', () => {
		const context = configure();

		context.service.updateSelectedTimezone('asia/tokyo');

		expect(context.service.selectedTimezone()).toBe('Asia/Tokyo');
		expect(lastSaved(context)).toMatchObject({ type: 'TIMEZONE', payload: 'Asia/Tokyo' });
	});

	it('saves the device zone instead of a zone Intl does not accept', () => {
		const context = configure([timezoneSetting('Asia/Tokyo')]);

		context.service.updateSelectedTimezone('Mars/Olympus_Mons');

		expect(context.service.selectedTimezone()).toBe(DEFAULT_TIMEZONE);
		expect(lastSaved(context).payload).toBe(DEFAULT_TIMEZONE);
	});

	it('updates the stored setting instead of creating a second one', () => {
		const stored = timezoneSetting('Asia/Tokyo');
		const context = configure([stored]);

		context.service.updateSelectedTimezone('Europe/Kiev');

		const saved = lastSaved(context);

		expect(saved.uuid).toBe(stored.uuid);
		expect(KYIV).toContain(saved.payload);
		expect(context.store.save).toHaveBeenCalledTimes(1);
	});
});
