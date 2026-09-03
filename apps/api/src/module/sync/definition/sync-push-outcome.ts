import type {
	PushTrainingResult,
	SyncEntity,
	SyncNodeParsed,
	SyncRejection,
} from '@chesspecker/api-definitions';


/**
 * What a push reports back: the uuid each row ended up with, so the device can rekey, and
 * the ones that will never land, so it stops retrying them.
 */
export class SyncPushOutcome {
	private readonly uuids: Record<SyncEntity, Record<string, string>> = {
		training: {},
		trainingGoal: {},
		calibrationRound: {},
		calibrationPuzzle: {},
		trainingPuzzle: {},
		cycle: {},
		cycleItem: {},
		attempt: {},
	};

	private readonly rejected: SyncRejection[] = [];

	constructor(private readonly receivedAt: Date) {}

	keep(entity: SyncEntity, node: SyncNodeParsed, uuid: string): void {
		if (undefined !== node.clientRef) {
			this.uuids[entity][node.clientRef] = uuid;
		}
	}

	reject(entity: SyncEntity, node: SyncNodeParsed, reason: string): void {
		if (undefined !== node.clientRef) {
			this.rejected.push({ clientRef: node.clientRef, entity, reason });
		}
	}

	toResult(): PushTrainingResult {
		return {
			receivedAt: this.receivedAt.toISOString(),
			uuids: this.uuids,
			rejected: this.rejected,
		};
	}
}
