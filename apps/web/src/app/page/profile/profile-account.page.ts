import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonDirective } from '@app/directive/button.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { SessionStore } from '@app/store/session.store';
import { LogOutUseCase } from '@app/use-case/log-out.use-case';

@Component({
	templateUrl: './profile-account.page.html',
	styleUrl: './profile-account.page.scss',
	imports: [ButtonDirective, I18nPipe],
	providers: [provideI18nScope('profile')],
})
export class ProfileAccountPage {
	protected readonly I18n = I18n;

	readonly session = inject(SessionStore);

	private readonly logOutUseCase = inject(LogOutUseCase);
	private readonly router = inject(Router);

	logOut(): void {
		void this.logOutAndLeave();
	}

	private async logOutAndLeave(): Promise<void> {
		if (await this.logOutUseCase.execute()) {
			await this.router.navigateByUrl('/profile');
		}
	}
}
