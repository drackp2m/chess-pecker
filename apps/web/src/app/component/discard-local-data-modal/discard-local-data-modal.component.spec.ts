import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiscardLocalDataModalComponent } from '@app/component/discard-local-data-modal/discard-local-data-modal.component';
import { I18n } from '@app/i18n';
import { provideTestingI18n } from '@app/testing/i18n.harness';

interface Setup {
	readonly action: 'log-in' | 'register';
	readonly owner?: string;
}

function createModal({ action, owner }: Setup) {
	const router = { navigateByUrl: vi.fn((_url: string) => Promise.resolve(true)) };

	TestBed.configureTestingModule({
		providers: [provideTestingI18n(), { provide: Router, useValue: router }],
	});

	const fixture = TestBed.createComponent(DiscardLocalDataModalComponent);

	fixture.componentRef.setInput('action', action);
	fixture.componentRef.setInput('owner', owner ?? null);
	fixture.detectChanges();

	const element = fixture.nativeElement as HTMLElement;

	return {
		router,
		modal: fixture.componentInstance,
		buttons: [...element.querySelectorAll('button')],
	};
}

async function answerOf(
	modal: DiscardLocalDataModalComponent,
	button: HTMLButtonElement | undefined,
): Promise<boolean> {
	const answered = firstValueFrom(modal.onClose$);

	button?.click();

	return answered;
}

describe('DiscardLocalDataModalComponent', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('recommends creating an account first when nobody owns the device', () => {
		const { buttons } = createModal({ action: 'log-in' });

		expect(buttons).toHaveLength(3);
	});

	it('takes the user to sign up instead of logging in', async () => {
		const { modal, buttons, router } = createModal({ action: 'log-in' });

		expect(await answerOf(modal, buttons[0])).toBe(false);
		expect(router.navigateByUrl).toHaveBeenCalledWith('/register');
	});

	it('only lets the user cancel or log in anyway when the device belongs to another account', async () => {
		const { modal, buttons } = createModal({ action: 'log-in', owner: 'ada' });

		expect(buttons).toHaveLength(2);
		expect(buttons[1]?.textContent).toContain(I18n.common.LOG_IN);
		expect(await answerOf(modal, buttons[1])).toBe(true);
	});

	it('goes on with the sign-up button when the warning comes from signing up', async () => {
		const { modal, buttons } = createModal({ action: 'register', owner: 'ada' });

		expect(buttons).toHaveLength(2);
		expect(buttons[1]?.textContent).toContain(I18n.common.CREATE_ACCOUNT);
		expect(await answerOf(modal, buttons[1])).toBe(true);
	});
});
