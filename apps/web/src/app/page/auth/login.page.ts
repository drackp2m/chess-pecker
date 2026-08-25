import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { SessionStore } from '@app/store/session.store';
import { LogInUseCase } from '@app/use-case/log-in.use-case';

@Component({
	templateUrl: './login.page.html',
	styleUrl: './auth.page.scss',
	imports: [ReactiveFormsModule, InputDirective, ButtonDirective, RouterLinkDirective, I18nPipe],
	providers: [provideI18nScope('auth')],
})
export class LoginPage {
	protected readonly I18n = I18n;

	readonly form = new FormGroup({
		username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
		password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
	});

	private readonly sessionStore = inject(SessionStore);
	private readonly logInUseCase = inject(LogInUseCase);
	private readonly router = inject(Router);

	readonly error = this.sessionStore.error;
	readonly isSubmitting = this.sessionStore.isSubmitting;

	constructor() {
		this.sessionStore.clearError();
	}

	submit(): void {
		void this.logIn();
	}

	private async logIn(): Promise<void> {
		if (this.form.invalid) {
			this.form.markAllAsTouched();

			return;
		}

		const succeeded = await this.logInUseCase.execute(this.form.getRawValue());

		if (succeeded) {
			await this.router.navigate(['/']);
		}
	}
}
