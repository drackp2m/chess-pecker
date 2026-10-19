import { Injectable, inject } from '@angular/core';

import {
	isAccountSetting,
	toRemoteKey,
} from '@app/definition/model/setting/setting-scope.constant';
import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';
import { UserSettingRepository } from '@app/repository/user-setting.repository';
import { SessionStore } from '@app/store/session.store';
import { fromRemote, isPending, mergeSettings } from '@app/util/setting-merge';

export interface SettingPull {
	readonly rows: readonly Setting[];
	readonly isChanged: boolean;
}

@Injectable({
	providedIn: 'root',
})
export class SettingMirrorUseCase {
	private readonly localRepository = inject(SettingRepository);
	private readonly remoteRepository = inject(UserSettingRepository);
	private readonly sessionStore = inject(SessionStore);

	async pull(): Promise<SettingPull> {
		const remote = await this.remoteRepository.list();
		const local = await this.localRepository.findAll('setting');
		const { adopt, push } = mergeSettings(local, remote);
		const adopted = await this.adoptAll(local, adopt);
		const overruled = await this.pushAll(push);

		return {
			rows: await this.localRepository.findAll('setting'),
			isChanged: adopted || overruled,
		};
	}

	async push(setting: Setting): Promise<Setting | null> {
		if (!this.sessionStore.isAuthenticated() || !isAccountSetting(setting.type)) {
			return null;
		}

		try {
			const answer = await this.remoteRepository.upsert(
				toRemoteKey(setting.type),
				setting.payload,
				setting.updatedAt,
			);

			return await this.localRepository.replace(setting, fromRemote(setting.type, answer, setting));
		} catch (error) {
			console.error(`Could not upload the \`${setting.type}\` setting`, error);

			return null;
		}
	}

	async pushPending(): Promise<void> {
		const rows = await this.localRepository.findAll('setting');

		for (const row of rows) {
			if (isPending(row)) {
				await this.push(row);
			}
		}
	}

	private async adoptAll(local: readonly Setting[], adopt: readonly Setting[]): Promise<boolean> {
		let isChanged = false;

		for (const setting of adopt) {
			const expected = local.find((candidate) => setting.type === candidate.type);

			if (null !== (await this.localRepository.replace(expected, setting))) {
				isChanged = true;
			}
		}

		return isChanged;
	}

	private async pushAll(push: readonly Setting[]): Promise<boolean> {
		let isChanged = false;

		for (const setting of push) {
			const stored = await this.push(setting);

			if (null !== stored && stored.updatedAt.getTime() > setting.updatedAt.getTime()) {
				isChanged = true;
			}
		}

		return isChanged;
	}
}
