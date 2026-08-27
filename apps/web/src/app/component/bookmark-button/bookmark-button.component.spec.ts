import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BookmarkButtonComponent } from '@app/component/bookmark-button/bookmark-button.component';
import { BookmarkChoice } from '@app/component/bookmark-modal/bookmark-modal.component';
import { LONG_PRESS_MS } from '@app/definition/long-press.constant';
import { BookmarkPreferenceService } from '@app/service/bookmark-preference.service';
import { BookmarkStore } from '@app/store/bookmark.store';
import { ModalStore } from '@app/store/modal.store';
import { provideTestingI18n } from '@app/testing/i18n.harness';

const LICHESS_ID = 'JOGv3';

const SETTLE_TURNS = 20;

interface Options {
	readonly filedAs?: PuzzleBookmarkType | undefined;
	readonly isPromptEnabled?: boolean;
	readonly answer?: BookmarkChoice | null;
}

function createButton({ filedAs, isPromptEnabled = true, answer }: Options = {}) {
	const filed = signal<PuzzleBookmarkType | undefined>(filedAs);
	const prompt = signal(isPromptEnabled);
	const opened = vi.fn();

	TestBed.configureTestingModule({
		providers: [
			provideTestingI18n(),
			{
				provide: BookmarkStore,
				useValue: {
					typeOf: (): PuzzleBookmarkType | undefined => filed(),
					file: (_id: string, type: PuzzleBookmarkType): Promise<void> => {
						filed.set(type);

						return Promise.resolve();
					},
					unfile: (): Promise<void> => {
						filed.set(undefined);

						return Promise.resolve();
					},
				},
			},
			{
				provide: BookmarkPreferenceService,
				useValue: {
					isPromptEnabled: prompt.asReadonly(),
					updatePrompt: (value: boolean): void => {
						prompt.set(value);
					},
				},
			},
			{
				provide: ModalStore,
				useValue: {
					open: () => {
						opened();

						return Promise.resolve({
							setInput: (): void => undefined,
							instance: { onClose$: of(answer ?? null) },
						});
					},
				},
			},
		],
	});

	const fixture = TestBed.createComponent(BookmarkButtonComponent);

	fixture.componentRef.setInput('lichessId', LICHESS_ID);
	fixture.detectChanges();

	const button = (fixture.nativeElement as HTMLElement).querySelector('button');

	if (null === button) {
		throw new Error('The bookmark button did not render.');
	}

	return { fixture, button, filed, prompt, opened };
}

function press(element: HTMLElement, held = false): void {
	element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10 }));

	if (held) {
		vi.advanceTimersByTime(LONG_PRESS_MS);
	}

	element.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10 }));
	element.dispatchEvent(new MouseEvent('click'));
}

async function settle(): Promise<void> {
	for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
		await Promise.resolve();
	}
}

describe('BookmarkButtonComponent', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('shows the list an exercise is filed under', () => {
		const { button } = createButton({ filedAs: 'favorite' });

		expect(button.classList.contains('active')).toBe(true);
	});

	it('says nothing about the list while it cannot be pressed', () => {
		const { fixture, button } = createButton({ filedAs: 'favorite' });

		fixture.componentRef.setInput('isDisabled', true);
		fixture.detectChanges();

		expect(button.classList.contains('active')).toBe(false);
	});

	it('answers neither a press nor a hold while it cannot be pressed', async () => {
		const { fixture, button, filed, opened } = createButton({ isPromptEnabled: false });

		fixture.componentRef.setInput('isDisabled', true);
		fixture.detectChanges();

		press(button);
		press(button, true);
		await settle();

		expect(filed()).toBeUndefined();
		expect(opened).not.toHaveBeenCalled();
		expect(button.classList.contains('holding')).toBe(false);
	});

	it('files a favorite without asking once the question is turned off', async () => {
		const { button, filed, opened } = createButton({ isPromptEnabled: false });

		press(button);
		await settle();

		expect(filed()).toBe('favorite');
		expect(opened).not.toHaveBeenCalled();
	});

	it('turns the question back on when the box comes back unticked', async () => {
		const { button, prompt, opened } = createButton({
			isPromptEnabled: false,
			answer: { type: 'favorite', skipPrompt: false },
		});

		press(button, true);
		await settle();

		expect(opened).toHaveBeenCalled();
		expect(prompt()).toBe(true);
	});

	it('leaves the question turned off when another list is chosen', async () => {
		const { button, filed, prompt } = createButton({
			isPromptEnabled: false,
			answer: { type: 'hard', skipPrompt: true },
		});

		press(button, true);
		await settle();

		expect(filed()).toBe('hard');
		expect(prompt()).toBe(false);
	});

	it('turns the question back on when the exercise is taken out of its list', async () => {
		const { button, filed, prompt } = createButton({
			filedAs: 'favorite',
			isPromptEnabled: false,
			answer: { type: null, skipPrompt: false },
		});

		press(button, true);
		await settle();

		expect(filed()).toBeUndefined();
		expect(prompt()).toBe(true);
	});

	it('turns the question off when the box comes back ticked', async () => {
		const { button, filed, prompt } = createButton({
			answer: { type: 'favorite', skipPrompt: true },
		});

		press(button);
		await settle();

		expect(filed()).toBe('favorite');
		expect(prompt()).toBe(false);
	});

	it('leaves both the list and the question alone when the modal is cancelled', async () => {
		const { button, filed, prompt } = createButton({
			filedAs: 'favorite',
			isPromptEnabled: false,
			answer: null,
		});

		press(button, true);
		await settle();

		expect(filed()).toBe('favorite');
		expect(prompt()).toBe(false);
	});
});
