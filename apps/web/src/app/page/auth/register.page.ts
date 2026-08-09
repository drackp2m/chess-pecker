import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { RegisterRequest } from '@chesspecker/api-definitions';

import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { SessionStore } from '@app/store/session.store';

const MIN_PASSWORD_LENGTH = 8;

@Component({
	templateUrl: './register.page.html',
	styleUrl: './auth.page.scss',
	imports: [ReactiveFormsModule, InputDirective, ButtonDirective, RouterLinkDirective, I18nPipe],
	providers: [provideI18nScope('auth')],
})
export class RegisterPage {
	protected readonly I18n = I18n;

	readonly minPasswordLength = MIN_PASSWORD_LENGTH;

	readonly form = new FormGroup({
		username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
		email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
		password: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
		}),
	});

	private readonly sessionStore = inject(SessionStore);
	private readonly router = inject(Router);

	readonly error = this.sessionStore.error;
	readonly isSubmitting = this.sessionStore.isSubmitting;

	constructor() {
		this.sessionStore.clearError();
	}

	submit(): void {
		void this.register();
	}

	private async register(): Promise<void> {
		if (this.form.invalid) {
			this.form.markAllAsTouched();

			return;
		}

		const succeeded = await this.sessionStore.register(this.buildRequest());

		if (succeeded) {
			await this.router.navigate(['/']);
		}
	}

	private buildRequest(): RegisterRequest {
		const { username, email, password } = this.form.getRawValue();
		const trimmedEmail = email.trim();

		return {
			username,
			password,
			...('' === trimmedEmail ? {} : { email: trimmedEmail }),
		};
	}
}
