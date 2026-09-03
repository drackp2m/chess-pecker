import { Injectable, computed, effect, inject } from '@angular/core';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';
import { patchState, signalStore, type, withState } from '@ngrx/signals';
import {
	entityConfig,
	removeAllEntities,
	removeEntity,
	setAllEntities,
	setEntity,
	withEntities,
} from '@ngrx/signals/entities';

import type { TranslationRef } from '@app/definition/i18n.type';
import { Resettable } from '@app/definition/resettable.interface';
import { I18n, i18nRef } from '@app/i18n';
import { BookmarkRow } from '@app/repository/definition/bookmark-schema.interface';
import { NotificationService } from '@app/service/notification.service';
import { SessionStore } from '@app/store/session.store';
import { BookmarkMirrorUseCase } from '@app/use-case/bookmark-mirror.use-case';

interface BookmarkStoreProps {
	isLoading: boolean;
	error: TranslationRef | null;
}

const initialState: BookmarkStoreProps = {
	isLoading: false,
	error: null,
};

const LOAD_ERROR_MESSAGE = i18nRef(I18n.common.BOOKMARK_LOAD_ERROR);
const SAVE_ERROR_MESSAGE = i18nRef(I18n.common.BOOKMARK_SAVE_ERROR);

const bookmarkConfig = entityConfig({
	entity: type<BookmarkRow>(),
	collection: 'bookmark',
	selectId: (bookmark) => bookmark.lichessId,
});

/**
 * Which list each exercise is filed under. The rows are the device's, and the account is
 * mirrored into them whenever a session opens: a bookmark never waits for the network.
 */
@Injectable({
	providedIn: 'root',
})
export class BookmarkStore
	extends signalStore(
		{ protectedState: false },
		withState(initialState),
		withEntities(bookmarkConfig),
	)
	implements Resettable
{
	private readonly mirror = inject(BookmarkMirrorUseCase);
	private readonly sessionStore = inject(SessionStore);
	private readonly notificationService = inject(NotificationService);

	private readonly byPuzzle = computed(
		() => new Map(this.bookmarkEntities().map((row) => [row.lichessId, row])),
	);

	/** What the device held, so a mirror never lands on top of a load that has not arrived. */
	private readonly loaded: Promise<void> = this.load();

	constructor() {
		super();

		this.watchSession();
	}

	/** The list an exercise is filed under, or nothing at all if it is not filed. */
	typeOf(lichessId: string): PuzzleBookmarkType | undefined {
		return this.byPuzzle().get(lichessId)?.type;
	}

	async file(lichessId: string, type: PuzzleBookmarkType): Promise<void> {
		try {
			const saved = await this.mirror.file(lichessId, this.byPuzzle().get(lichessId), type);

			patchState(this, setEntity(saved, bookmarkConfig), { error: null });
		} catch (error: unknown) {
			this.report(`Could not file the \`${lichessId}\` exercise`, error, SAVE_ERROR_MESSAGE);
		}
	}

	async unfile(lichessId: string): Promise<void> {
		const current = this.byPuzzle().get(lichessId);

		if (undefined === current) {
			return;
		}

		try {
			await this.mirror.unfile(current);

			patchState(this, removeEntity(lichessId, bookmarkConfig), { error: null });
		} catch (error: unknown) {
			this.report(`Could not unfile the \`${lichessId}\` exercise`, error, SAVE_ERROR_MESSAGE);
		}
	}

	async ready(): Promise<void> {
		await this.loaded;
	}

	reset(): void {
		patchState(this, initialState, removeAllEntities(bookmarkConfig));
	}

	private async load(): Promise<void> {
		patchState(this, { isLoading: true });

		try {
			patchState(this, setAllEntities(live(await this.mirror.read()), bookmarkConfig));
		} catch (error: unknown) {
			this.report('Could not load the stored bookmarks', error, LOAD_ERROR_MESSAGE);
		} finally {
			patchState(this, { isLoading: false });
		}
	}

	/**
	 * The account's lists come down on the first session of the run and after every later
	 * one: what the device filed while logged out goes up in the same pass.
	 */
	private watchSession(): void {
		let mirrored = false;

		effect(() => {
			if (!this.sessionStore.isAuthenticated()) {
				mirrored = false;

				return;
			}

			if (!mirrored) {
				mirrored = true;
				void this.pull();
			}
		});
	}

	private async pull(): Promise<void> {
		try {
			await this.loaded;

			patchState(this, setAllEntities(live(await this.mirror.pull()), bookmarkConfig));
		} catch (error: unknown) {
			// Silent on purpose: the device already answers with what it holds, and saying
			// the lists could not be brought down would be noise on every flaky trip.
			console.error('Could not mirror the stored bookmarks', error);
		}
	}

	private report(message: string, error: unknown, notice: TranslationRef): void {
		console.error(message, error);

		this.notificationService.notify(notice);
		patchState(this, { error: notice });
	}
}

function live(rows: readonly BookmarkRow[]): BookmarkRow[] {
	return rows.filter((row) => undefined === row.removedAt);
}
