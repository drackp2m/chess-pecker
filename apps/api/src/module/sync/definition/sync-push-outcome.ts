import type { PushTrainingResult, SyncEntity, SyncRejection } from '@chesspecker/api-definitions';

import { SyncNodeDto } from '../dto/request/sync-node.dto';

/**
 * Lo que la subida tiene que contar de vuelta: con qué uuid se quedó cada fila, para que el
 * dispositivo reclave la suya, y cuáles no van a entrar nunca, para que deje de reintentarlas.
 *
 * Una fila sin `clientRef` no nació en un dispositivo: ya está arriba y no hay nada que
 * mapear ni que rechazar.
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

	keep(entity: SyncEntity, node: SyncNodeDto, uuid: string): void {
		if (undefined !== node.clientRef) {
			this.uuids[entity][node.clientRef] = uuid;
		}
	}

	reject(entity: SyncEntity, node: SyncNodeDto, reason: string): void {
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
