import { Injectable, effect, inject } from '@angular/core';
import type { AuthUser } from '@chesspecker/api-definitions';

import { LocalOwner } from '@app/definition/model/setting/local-owner.type';
import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';
import { SessionStore } from '@app/store/session.store';

@Injectable({
	providedIn: 'root',
})
export class LocalOwnerUseCase {
	private readonly settingRepository = inject(SettingRepository);
	private readonly sessionStore = inject(SessionStore);

	constructor() {
		this.watchSession();
	}

	async read(): Promise<LocalOwner | undefined> {
		const stored = await this.settingRepository.find('setting', 'OWNER');

		return stored?.payload as LocalOwner | undefined;
	}

	async claim(user: AuthUser): Promise<void> {
		const payload: LocalOwner = { uuid: user.uuid, username: user.username };
		const stored = await this.settingRepository.find('setting', 'OWNER');

		await this.settingRepository.insert(
			'setting',
			stored?.with({ payload }) ?? new Setting({ type: 'OWNER', payload }),
		);
	}

	async release(): Promise<void> {
		await this.settingRepository.delete('setting', 'OWNER');
	}

	private watchSession(): void {
		effect(() => {
			const user = this.sessionStore.user();

			if (null === user) {
				return;
			}

			void this.claim(user).catch((error: unknown) => {
				console.error('Could not record who this device belongs to', error);
			});
		});
	}
}
