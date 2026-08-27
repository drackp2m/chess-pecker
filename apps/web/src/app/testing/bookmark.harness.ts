import { Provider, signal } from '@angular/core';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { BookmarkPreferenceService } from '@app/service/bookmark-preference.service';
import { BookmarkStore } from '@app/store/bookmark.store';

const provideTestingBookmarkStore = (): Provider => {
	const filed = signal(new Map<string, PuzzleBookmarkType>());

	return {
		provide: BookmarkStore,
		useValue: {
			typeOf: (lichessId: string): PuzzleBookmarkType | undefined => filed().get(lichessId),
			file: (lichessId: string, type: PuzzleBookmarkType): Promise<void> => {
				filed.update((current) => new Map(current).set(lichessId, type));

				return Promise.resolve();
			},
			unfile: (lichessId: string): Promise<void> => {
				filed.update((current) => {
					const next = new Map(current);
					next.delete(lichessId);

					return next;
				});

				return Promise.resolve();
			},
		},
	};
};

const provideTestingBookmarkPreference = (): Provider => {
	const prompt = signal(true);

	return {
		provide: BookmarkPreferenceService,
		useValue: {
			isPromptEnabled: prompt.asReadonly(),
			updatePrompt: (isEnabled: boolean): void => {
				prompt.set(isEnabled);
			},
		},
	};
};

export const provideTestingBookmarks = (): Provider[] => [
	provideTestingBookmarkStore(),
	provideTestingBookmarkPreference(),
];
