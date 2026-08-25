import { Injectable, inject } from '@angular/core';
import type { AuthUser, LoginRequest } from '@chesspecker/api-definitions';

import { LocalOwner } from '@app/definition/model/setting/local-owner.type';
import { SessionStore } from '@app/store/session.store';
import { DiscardLocalDataUseCase } from '@app/use-case/discard-local-data.use-case';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';

@Injectable({
	providedIn: 'root',
})
export class LogInUseCase {
	private readonly discardLocalDataUseCase = inject(DiscardLocalDataUseCase);
	private readonly localOwnerUseCase = inject(LocalOwnerUseCase);
	private readonly sessionStore = inject(SessionStore);

	async execute(request: LoginRequest): Promise<boolean> {
		const owner = await this.localOwnerUseCase.read();

		if (owner?.username !== request.username && !(await this.discardLocalDataUseCase.confirm())) {
			return false;
		}

		return this.sessionStore.logIn(request, (user) => this.adopt(owner, user));
	}

	private async adopt(owner: LocalOwner | undefined, user: AuthUser): Promise<void> {
		if (owner?.uuid !== user.uuid) {
			await this.discardLocalDataUseCase.execute();
		}

		await this.localOwnerUseCase.claim(user);
	}
}
