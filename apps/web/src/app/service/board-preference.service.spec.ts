import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOVE_ANIMATION } from '@app/definition/board-animation.type';
import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { DEFAULT_MOVE_LIFT } from '@app/definition/piece-lift.constant';
import { Setting } from '@app/model/setting.model';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { SettingStore } from '@app/store/setting.store';

function stored(type: SettingTypeKey, payload: unknown): Setting {
	return new Setting({ type, payload: payload as never });
}

function configure(entities: Setting[] = []) {
	const store = {
		arrived: signal<readonly Setting[] | null>(null),
		settingEntities: signal(entities),
		save: vi.fn<(item: Setting) => void>(),
	};

	TestBed.configureTestingModule({
		providers: [{ provide: SettingStore, useValue: store }],
	});

	const service = TestBed.inject(BoardPreferenceService);

	TestBed.tick();

	return { service, store };
}

describe('BoardPreferenceService', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('stays on the defaults until the settings arrive', () => {
		const { service } = configure();

		expect(service.moveAnimation()).toBe(DEFAULT_MOVE_ANIMATION);
		expect(service.moveLift()).toBe(DEFAULT_MOVE_LIFT);
	});

	it('applies the animation and the lift the device stored', () => {
		const { service, store } = configure();

		store.arrived.set([stored('MOVE_ANIMATION', 'always'), stored('MOVE_LIFT', false)]);
		TestBed.tick();

		expect(service.moveAnimation()).toBe('always');
		expect(service.moveLift()).toBe(false);
	});

	it('applies the account settings that arrive after the device had none', () => {
		const { service, store } = configure();

		store.arrived.set([]);
		TestBed.tick();

		expect(service.moveAnimation()).toBe(DEFAULT_MOVE_ANIMATION);
		expect(service.moveLift()).toBe(DEFAULT_MOVE_LIFT);

		store.arrived.set([stored('MOVE_ANIMATION', 'always'), stored('MOVE_LIFT', false)]);
		TestBed.tick();

		expect(service.moveAnimation()).toBe('always');
		expect(service.moveLift()).toBe(false);
	});

	it('keeps a choice made on the device while nothing new arrives', () => {
		const { service, store } = configure();

		store.arrived.set([]);
		TestBed.tick();

		service.updateMoveLift(false);
		service.updateMoveAnimation('always');
		TestBed.tick();

		expect(service.moveLift()).toBe(false);
		expect(service.moveAnimation()).toBe('always');
	});

	it('saves a choice over the row already stored instead of adding another', () => {
		const lift = stored('MOVE_LIFT', true);
		const { service, store } = configure([lift]);

		service.updateMoveLift(false);

		expect(store.save).toHaveBeenCalledTimes(1);
		expect(store.save.mock.calls[0]?.[0]).toMatchObject({
			uuid: lift.uuid,
			type: 'MOVE_LIFT',
			payload: false,
		});
	});
});
