import { Injectable, inject } from '@angular/core';
import type { RegisterRequest } from '@chesspecker/api-definitions';

import { SessionStore } from '@app/store/session.store';
import { DiscardLocalDataUseCase } from '@app/use-case/discard-local-data.use-case';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';

@Injectable({
	providedIn: 'root',
})
export class RegisterUseCase {
	private readonly discardLocalDataUseCase = inject(DiscardLocalDataUseCase);
	private readonly localOwnerUseCase = inject(LocalOwnerUseCase);
	private readonly sessionStore = inject(SessionStore);

	async execute(request: RegisterRequest): Promise<boolean> {
		if (undefined === (await this.localOwnerUseCase.read())) {
			return this.sessionStore.register(request);
		}

		if (!(await this.discardLocalDataUseCase.confirm())) {
			return false;
		}

		return this.sessionStore.register(request, () => this.discardLocalDataUseCase.execute());
	}
}
