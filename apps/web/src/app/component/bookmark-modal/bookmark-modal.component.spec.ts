import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import {
	BookmarkChoice,
	BookmarkModalComponent,
} from '@app/component/bookmark-modal/bookmark-modal.component';
import { BookmarkPreferenceService } from '@app/service/bookmark-preference.service';
import { provideTestingI18n } from '@app/testing/i18n.harness';

function createModal(isPromptEnabled: boolean) {
	const prompt = signal(isPromptEnabled);

	TestBed.configureTestingModule({
		providers: [
			provideTestingI18n(),
			{
				provide: BookmarkPreferenceService,
				useValue: {
					isPromptEnabled: prompt.asReadonly(),
					updatePrompt: (value: boolean): void => {
						prompt.set(value);
					},
				},
			},
		],
	});

	const fixture = TestBed.createComponent(BookmarkModalComponent);

	fixture.componentRef.setInput('current', 'favorite');
	fixture.detectChanges();

	const element = fixture.nativeElement as HTMLElement;

	return {
		fixture,
		modal: fixture.componentInstance,
		checkbox: element.querySelector<HTMLInputElement>('input[type="checkbox"]'),
		radios: [...element.querySelectorAll<HTMLInputElement>('input[type="radio"]')],
	};
}

async function answerOf(
	modal: BookmarkModalComponent,
	act: () => void,
): Promise<BookmarkChoice | null> {
	const answered = firstValueFrom(modal.onClose$);

	act();

	return answered;
}

describe('BookmarkModalComponent', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('opens with the box ticked when the question is already turned off', () => {
		const { checkbox } = createModal(false);

		expect(checkbox?.checked).toBe(true);
	});

	it('opens with the box unticked while the question is still asked', () => {
		const { checkbox } = createModal(true);

		expect(checkbox?.checked).toBe(false);
	});

	it('carries the ticked box out with the list it was ticked for', async () => {
		const { fixture, modal, checkbox } = createModal(true);

		checkbox?.click();
		fixture.detectChanges();

		const answer = await answerOf(modal, () => {
			modal.confirm();
		});

		expect(answer).toEqual({ type: 'favorite', skipPrompt: true });
	});

	it('takes the box down when another list is chosen, and says so', async () => {
		const { fixture, modal, checkbox, radios } = createModal(false);

		radios[1]?.click();
		fixture.detectChanges();

		const answer = await answerOf(modal, () => {
			modal.confirm();
		});

		expect(checkbox?.checked).toBe(false);
		expect(checkbox?.disabled).toBe(true);
		expect(answer).toEqual({ type: 'hard', skipPrompt: false });
	});

	it('carries the box out when the exercise is taken out of its list too', async () => {
		const { fixture, modal, checkbox } = createModal(false);

		checkbox?.click();
		fixture.detectChanges();

		const answer = await answerOf(modal, () => {
			modal.remove();
		});

		expect(answer).toEqual({ type: null, skipPrompt: false });
	});

	it('answers nothing at all when it is cancelled', async () => {
		const { fixture, modal, checkbox } = createModal(false);

		checkbox?.click();
		fixture.detectChanges();

		const answer = await answerOf(modal, () => {
			modal.dismiss();
		});

		expect(answer).toBeNull();
	});
});
