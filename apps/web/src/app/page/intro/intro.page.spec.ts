import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INTRO_STEPS } from '@app/definition/intro-step.type';
import { IntroPage } from '@app/page/intro/intro.page';
import { TrainingRow } from '@app/repository/definition/training-schema.interface';
import { IntroStore } from '@app/store/intro.store';
import { TrainingStore } from '@app/store/training.store';
import { provideTestingI18n } from '@app/testing/i18n.harness';

const NOW = new Date('2026-08-25T09:00:00.000Z');

const RUNNING: TrainingRow = {
	uuid: 'training-1',
	status: 'running',
	createdAt: NOW,
	updatedAt: NOW,
};

interface Options {
	readonly isLast?: boolean;
	readonly isRevisit?: boolean;
	readonly active?: TrainingRow | null;
	readonly canSolve?: boolean;
}

async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function stubMatchMedia(): void {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: (media: string) => ({
			media,
			matches: false,
			onchange: null,
			addEventListener: (): void => undefined,
			removeEventListener: (): void => undefined,
			addListener: (): void => undefined,
			removeListener: (): void => undefined,
			dispatchEvent: () => false,
		}),
	});
}

function configure(options: Options = {}) {
	const isLast = options.isLast ?? true;
	const index = signal(isLast ? INTRO_STEPS.length - 1 : 0);
	const intro = {
		index,
		step: () => INTRO_STEPS[index()] ?? INTRO_STEPS[0],
		stepCount: INTRO_STEPS.length,
		isFirst: () => 0 === index(),
		isLast: () => isLast,
		isRevisit: () => options.isRevisit ?? false,
		enter: vi.fn(),
		next: vi.fn(),
		previous: vi.fn(),
		complete: vi.fn(),
	};
	const active: WritableSignal<TrainingRow | null> = signal(options.active ?? null);
	const training = {
		active,
		canSolve: () => options.canSolve ?? false,
		isSubmitting: () => false,
		load: vi.fn(() => Promise.resolve()),
		start: vi.fn(() => {
			active.set(RUNNING);

			return Promise.resolve(true);
		}),
	};
	const router = { navigate: vi.fn(() => Promise.resolve(true)) };

	TestBed.configureTestingModule({
		imports: [IntroPage],
		providers: [
			provideTestingI18n(),
			{ provide: IntroStore, useValue: intro },
			{ provide: TrainingStore, useValue: training },
			{ provide: Router, useValue: router },
		],
	});

	return { intro, training, router, page: TestBed.createComponent(IntroPage).componentInstance };
}

describe('IntroPage.forward', () => {
	beforeEach(() => {
		stubMatchMedia();
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('only walks to the next step while there are steps left', async () => {
		const { page, intro, training } = configure({ isLast: false });

		page.forward();
		await settle();

		expect(intro.next).toHaveBeenCalledTimes(1);
		expect(intro.complete).not.toHaveBeenCalled();
		expect(training.start).not.toHaveBeenCalled();
	});

	it('starts a training and opens the board at the end of the first pass', async () => {
		const { page, intro, training, router } = configure({ canSolve: true });

		page.forward();
		await settle();

		expect(intro.complete).toHaveBeenCalledTimes(1);
		expect(training.start).toHaveBeenCalledTimes(1);
		expect(router.navigate).toHaveBeenCalledWith(['/training/solve']);
	});

	it('lands on the panel when the new training has nothing to solve yet', async () => {
		const { page, router } = configure({ canSolve: false });

		page.forward();
		await settle();

		expect(router.navigate).toHaveBeenCalledWith(['/training']);
	});

	it('never opens a second training over the one already in progress', async () => {
		const { page, training, router } = configure({ active: RUNNING, canSolve: true });

		page.forward();
		await settle();

		expect(training.load).toHaveBeenCalledTimes(1);
		expect(training.start).not.toHaveBeenCalled();
		expect(router.navigate).toHaveBeenCalledWith(['/training/solve']);
	});

	it('just closes on a revisit, leaving the training alone', async () => {
		const { page, intro, training, router } = configure({ isRevisit: true });

		page.forward();
		await settle();

		expect(intro.complete).toHaveBeenCalledTimes(1);
		expect(training.load).not.toHaveBeenCalled();
		expect(training.start).not.toHaveBeenCalled();
		expect(router.navigate).toHaveBeenCalledWith(['/']);
	});
});
