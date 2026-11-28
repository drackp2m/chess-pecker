import { Injectable, inject } from '@angular/core';
import type { Avatar } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';
import { UserRepository } from '@app/repository/user.repository';
import { SessionStore } from '@app/store/session.store';
import { HttpError } from '@app/util/http-error';

interface AvatarStoreProps {
	isSubmitting: boolean;
	error: TranslationRef | null;
	notice: TranslationRef | null;
}

const initialState: AvatarStoreProps = {
	isSubmitting: false,
	error: null,
	notice: null,
};

@Injectable({
	providedIn: 'root',
})
export class AvatarStore extends signalStore({ protectedState: false }, withState(initialState)) {
	private readonly userRepository = inject(UserRepository);
	private readonly session = inject(SessionStore);

	async save(avatar: Avatar): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null, notice: null });

		try {
			this.session.adoptAvatar(await this.userRepository.updateAvatar(avatar));
		} catch (error) {
			patchState(this, {
				isSubmitting: false,
				error: HttpError.toRef(error, i18nRef(I18n.profile.AVATAR_SAVE_ERROR)),
			});

			return false;
		}

		patchState(this, { isSubmitting: false, notice: i18nRef(I18n.profile.AVATAR_SAVED) });

		return true;
	}

	clearFeedback(): void {
		patchState(this, { error: null, notice: null });
	}
}
