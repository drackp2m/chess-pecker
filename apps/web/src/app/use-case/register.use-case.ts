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
		const owner = await this.localOwnerUseCase.read();

		if (undefined === owner) {
			return this.sessionStore.register(request);
		}

		if (!(await this.discardLocalDataUseCase.confirm({ action: 'register', owner }))) {
			return false;
		}

		return this.sessionStore.register(request, () => this.discardLocalDataUseCase.execute());
	}
}
