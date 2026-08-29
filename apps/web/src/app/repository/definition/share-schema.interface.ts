import type { PuzzleShareParticipant } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

/**
 * A challenge this device sent, as the account holds it. The API owns these rows: nothing is
 * ever written here first, so there is no pending mark and nothing to push. The copy exists
 * to answer what has already been shared without a trip, and to say how it went.
 */
export interface ShareRow {
	readonly uuid: string;
	/** The exercise as the front names it, the reference a bookmark already travels under. */
	readonly lichessId: string;
	readonly message: string | null;
	readonly sender: PuzzleShareParticipant;
	readonly recipients: readonly PuzzleShareParticipant[];
	readonly createdAt: Date;
	/** The challenge's clock, answers included: what the mirror walks the feed by. */
	readonly updatedAt: Date;
}

export interface ShareSchema extends DBSchema {
	share: {
		key: string;
		value: ShareRow;
		indexes: { lichessId: string };
	};
}
