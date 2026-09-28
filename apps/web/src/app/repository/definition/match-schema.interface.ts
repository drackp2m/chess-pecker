import { DBSchema } from 'idb';

import { MatchSnapshot } from '@app/definition/match.type';

export const CURRENT_MATCH = 'current';

export interface MatchRow extends MatchSnapshot {
	readonly id: typeof CURRENT_MATCH;
	readonly updatedAt: Date;
}

export interface MatchSchema extends DBSchema {
	match: {
		key: typeof CURRENT_MATCH;
		value: MatchRow;
	};
}
