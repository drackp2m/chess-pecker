import { Provider } from '@angular/core';
import type { PuzzleShare } from '@chesspecker/api-definitions';

import { ShareStore } from '@app/store/share.store';

export const provideTestingShares = (): Provider => {
	const shared = new Map<string, PuzzleShare[]>();

	return {
		provide: ShareStore,
		useValue: {
			sharesOf: (lichessId: string): readonly PuzzleShare[] => shared.get(lichessId) ?? [],
			hasShared: (lichessId: string): boolean => shared.has(lichessId),
			record: (share: PuzzleShare): Promise<void> => {
				const bucket = shared.get(share.lichessId) ?? [];

				bucket.push(share);
				shared.set(share.lichessId, bucket);

				return Promise.resolve();
			},
		},
	};
};
