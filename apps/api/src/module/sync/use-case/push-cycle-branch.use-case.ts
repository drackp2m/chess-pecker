import { Injectable } from '@nestjs/common';

import { TrainingCycleStatus } from '../../training/definition/training-cycle-status.enum';
import { PuzzleAttempt } from '../../training/puzzle-attempt.entity';
import { TrainingCycleItem } from '../../training/training-cycle-item.entity';
import { TrainingCycle } from '../../training/training-cycle.entity';
import { TrainingPuzzle } from '../../training/training-puzzle.entity';
import { Training } from '../../training/training.entity';
import { ApplySyncTimestampsUseCase } from '../../training/use-case/apply-sync-timestamps.use-case';
import { SyncPushContext } from '../definition/sync-push-context.interface';
import { PushCycleItemNodeDto } from '../dto/request/push-cycle-item-node.dto';
import { PushCycleNodeDto } from '../dto/request/push-cycle-node.dto';
import { claimSyncRow, isFresherNode, reuseSyncRow, syncKey } from '../util/sync-node.util';

import { PushSyncAttemptUseCase } from './push-sync-attempt.use-case';

/** La rama de las pasadas: los ciclos, el orden que fijaron y lo que se jugó en cada hueco. */
@Injectable()
export class PushCycleBranchUseCase {
	constructor(
		private readonly pushSyncAttemptUseCase: PushSyncAttemptUseCase,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	async execute(
		context: SyncPushContext,
		training: Training,
		nodes: PushCycleNodeDto[],
		set: ReadonlyMap<string, TrainingPuzzle>,
	): Promise<void> {
		for (const node of nodes) {
			const pushed = await this.pushCycle(context, training, node);

			if (undefined === pushed) {
				continue;
			}

			for (const itemNode of node.items) {
				await this.pushItem(context, training, pushed.row, itemNode, set);
			}

			if (pushed.closedHere) {
				await this.reopenIfUnfinished(context, pushed.row);
			}
		}
	}

	private async pushCycle(
		context: SyncPushContext,
		training: Training,
		node: PushCycleNodeDto,
	): Promise<PushedCycle | undefined> {
		const existing = await context.entityManager.findOne(TrainingCycle, syncKey(node, 'cycle'));

		if (null !== existing) {
			const belongsHere = existing.training.uuid === training.uuid;
			const reused = reuseSyncRow(context, 'cycle', node, existing, belongsHere, OTHER_TREE);

			if (undefined === reused) {
				return undefined;
			}

			return { row: reused, closedHere: this.refreshCycle(reused, node) };
		}

		const cycle = this.applySyncTimestampsUseCase.execute(
			new TrainingCycle({ training, index: node.index, status: node.status }),
			node,
		);

		return {
			row: claimSyncRow(context, 'cycle', node, cycle),
			closedHere: TrainingCycleStatus.Finished === node.status,
		};
	}

	/**
	 * La pasada sube abierta y se cierra —o se abandona— cuando el dispositivo lo decide.
	 * Devuelve si ha sido esta subida la que la ha dado por terminada, que es lo único que
	 * el servidor va a contrastar después.
	 */
	private refreshCycle(row: TrainingCycle, node: PushCycleNodeDto): boolean {
		if (!isFresherNode(node, row)) {
			return false;
		}

		row.status = node.status;

		this.applySyncTimestampsUseCase.execute(row, node);

		return TrainingCycleStatus.Finished === node.status;
	}

	/**
	 * «Terminado» es lo único que el dispositivo afirma y el servidor comprueba: abandonar
	 * es voluntad del usuario y vale siempre, pero un ciclo sólo está hecho cuando todos sus
	 * huecos tienen intento, y aquí están todos para contarlos. Va después de los huecos y
	 * con un `flush` delante porque los intentos que lo cierran suben en esta misma petición.
	 *
	 * Un cierre que no cuadra deja el ciclo abierto en vez de rechazar la fila: la bajada
	 * siguiente le devuelve al dispositivo el estado bueno sin tirar nada de lo que subió.
	 */
	private async reopenIfUnfinished(context: SyncPushContext, row: TrainingCycle): Promise<void> {
		await context.entityManager.flush();

		const items = await context.entityManager.find(
			TrainingCycleItem,
			{ cycle: row.uuid },
			{ fields: ['uuid'] },
		);
		const attempts = await context.entityManager.find(
			PuzzleAttempt,
			{ cycleItem: { cycle: row.uuid } },
			{ fields: ['cycleItem'] },
		);
		const attempted = new Set(attempts.map((attempt) => attempt.cycleItem?.uuid));

		if (0 < items.length && items.every((item) => attempted.has(item.uuid))) {
			return;
		}

		row.status = TrainingCycleStatus.Running;
	}

	private async pushItem(
		context: SyncPushContext,
		training: Training,
		cycle: TrainingCycle,
		node: PushCycleItemNodeDto,
		set: ReadonlyMap<string, TrainingPuzzle>,
	): Promise<void> {
		const item = await this.resolveItem(context, cycle, node, set);

		if (undefined === item) {
			return;
		}

		for (const attempt of node.attempts) {
			await this.pushSyncAttemptUseCase.cycle(context, training, item, attempt);
		}
	}

	/**
	 * El hueco necesita el ejercicio del set ya resuelto: si esa rama se rechazó —porque su
	 * ejercicio no está en el catálogo—, el hueco se va detrás y sus intentos con él.
	 */
	private async resolveItem(
		context: SyncPushContext,
		cycle: TrainingCycle,
		node: PushCycleItemNodeDto,
		set: ReadonlyMap<string, TrainingPuzzle>,
	): Promise<TrainingCycleItem | undefined> {
		const existing = await context.entityManager.findOne(
			TrainingCycleItem,
			syncKey(node, 'cycleItem'),
		);

		if (null !== existing) {
			const belongsHere = existing.cycle.uuid === cycle.uuid;

			return reuseSyncRow(context, 'cycleItem', node, existing, belongsHere, OTHER_CYCLE);
		}

		const trainingPuzzle = set.get(node.trainingPuzzleRef);

		if (undefined === trainingPuzzle) {
			context.outcome.reject('cycleItem', node, `unknown set entry \`${node.trainingPuzzleRef}\``);

			return undefined;
		}

		const item = this.applySyncTimestampsUseCase.execute(
			new TrainingCycleItem({ cycle, trainingPuzzle, position: node.position }),
			node,
		);

		return claimSyncRow(context, 'cycleItem', node, item);
	}
}

interface PushedCycle {
	readonly row: TrainingCycle;
	readonly closedHere: boolean;
}

const OTHER_TREE = 'belongs to another training';
const OTHER_CYCLE = 'belongs to another cycle';
