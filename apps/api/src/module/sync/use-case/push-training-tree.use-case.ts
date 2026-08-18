import type { PushTrainingResult } from '@chesspecker/api-definitions';
import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { TrainingGoal } from '../../training/training-goal.entity';
import { TrainingPuzzle } from '../../training/training-puzzle.entity';
import { Training } from '../../training/training.entity';
import { ApplySyncTimestampsUseCase } from '../../training/use-case/apply-sync-timestamps.use-case';
import { User } from '../../user/user.entity';
import { SyncPushContext } from '../definition/sync-push-context.interface';
import { SyncPushOutcome } from '../definition/sync-push-outcome';
import { PushGoalNodeDto } from '../dto/request/push-goal-node.dto';
import { PushTrainingNodeDto } from '../dto/request/push-training-node.dto';
import { PushTrainingPuzzleNodeDto } from '../dto/request/push-training-puzzle-node.dto';
import { PushTrainingRequestDto } from '../dto/request/push-training-request.dto';
import {
	claimSyncRow,
	isFresherNode,
	loadTreePuzzles,
	reuseSyncRow,
	syncKey,
} from '../util/sync-node.util';

import { PushCalibrationBranchUseCase } from './push-calibration-branch.use-case';
import { PushCycleBranchUseCase } from './push-cycle-branch.use-case';

/**
 * El árbol entero de un entrenamiento, en orden topológico y en una sola transacción: un
 * hijo necesita el uuid definitivo de su padre, así que o entra todo o no entra nada.
 *
 * El servidor no juzga el flujo —eso lo decidió el dispositivo, que es donde vive el
 * dominio—: comprueba de quién es el árbol, que las fechas sean creíbles y lo que digan los
 * `unique` y los `check` de las tablas.
 */
@Injectable()
export class PushTrainingTreeUseCase {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly pushCalibrationBranchUseCase: PushCalibrationBranchUseCase,
		private readonly pushCycleBranchUseCase: PushCycleBranchUseCase,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	async execute(user: User, request: PushTrainingRequestDto): Promise<PushTrainingResult> {
		const node = request.training;
		const receivedAt = new GenerateNowDateUseCase().execute();
		const outcome = new SyncPushOutcome(receivedAt);

		await this.entityManager.transactional(async (entityManager) => {
			const puzzles = await loadTreePuzzles(entityManager, node);
			const context: SyncPushContext = { entityManager, receivedAt, puzzles, outcome };
			const training = await this.pushTraining(context, user, node);

			await this.pushGoals(context, training, node.goals);

			const set = await this.pushSet(context, training, node.puzzles);

			await this.pushCalibrationBranchUseCase.execute(context, training, node.rounds);
			await this.pushCycleBranchUseCase.execute(context, training, node.cycles, set);
		});

		return outcome.toResult();
	}

	/** La puerta: el árbol es de quien lo sube, y eso es lo único que se comprueba aquí. */
	private async pushTraining(
		context: SyncPushContext,
		user: User,
		node: PushTrainingNodeDto,
	): Promise<Training> {
		const existing = await context.entityManager.findOne(Training, syncKey(node, 'training'));

		if (null !== existing) {
			if (existing.user.uuid !== user.uuid) {
				throw new ForbiddenException('not allowed', 'training');
			}

			this.refreshTraining(existing, node);
			context.outcome.keep('training', node, existing.uuid);

			return existing;
		}

		return claimSyncRow(context, 'training', node, this.buildTraining(user, node));
	}

	/** Terminar o cancelar un entrenamiento ocurre mucho después de que su árbol subiera. */
	private refreshTraining(row: Training, node: PushTrainingNodeDto): void {
		if (!isFresherNode(node, row)) {
			return;
		}

		row.status = node.status;

		if (undefined !== node.finishedReason) {
			row.finishedReason = node.finishedReason;
		}

		if (undefined !== node.finishedAt) {
			row.finishedAt = node.finishedAt;
		}

		this.applySyncTimestampsUseCase.execute(row, node);
	}

	private buildTraining(user: User, node: PushTrainingNodeDto): Training {
		return this.applySyncTimestampsUseCase.execute(
			new Training({
				user,
				status: node.status,
				...(undefined === node.finishedReason ? {} : { finishedReason: node.finishedReason }),
				...(undefined === node.finishedAt ? {} : { finishedAt: node.finishedAt }),
			}),
			node,
		);
	}

	private async pushGoals(
		context: SyncPushContext,
		training: Training,
		nodes: PushGoalNodeDto[],
	): Promise<void> {
		for (const node of nodes) {
			await this.pushGoal(context, training, node);
		}
	}

	private async pushGoal(
		context: SyncPushContext,
		training: Training,
		node: PushGoalNodeDto,
	): Promise<void> {
		const existing = await context.entityManager.findOne(
			TrainingGoal,
			syncKey(node, 'trainingGoal'),
		);

		if (null !== existing) {
			const belongsHere = existing.training.uuid === training.uuid;

			reuseSyncRow(context, 'trainingGoal', node, existing, belongsHere, OTHER_TREE);

			return;
		}

		if (undefined === node.puzzlesPerDay && undefined === node.endDate) {
			context.outcome.reject('trainingGoal', node, 'puzzlesPerDay or endDate is required');

			return;
		}

		claimSyncRow(context, 'trainingGoal', node, this.buildGoal(training, node));
	}

	private buildGoal(training: Training, node: PushGoalNodeDto): TrainingGoal {
		return this.applySyncTimestampsUseCase.execute(
			new TrainingGoal({
				training,
				...(undefined === node.puzzlesPerDay ? {} : { puzzlesPerDay: node.puzzlesPerDay }),
				...(undefined === node.endDate ? {} : { endDate: node.endDate }),
			}),
			node,
		);
	}

	/**
	 * El set, y el índice con el que los huecos de ciclo lo nombran: por el uuid de servidor
	 * y por la clave de reintento, porque un hueco puede haber nacido antes o después de que
	 * su ejercicio subiera.
	 */
	private async pushSet(
		context: SyncPushContext,
		training: Training,
		nodes: PushTrainingPuzzleNodeDto[],
	): Promise<Map<string, TrainingPuzzle>> {
		const stored = await context.entityManager.find(TrainingPuzzle, { training });
		const set = new Map<string, TrainingPuzzle>();

		for (const row of stored) {
			indexSetEntry(set, row);
		}

		for (const node of nodes) {
			const entry = await this.pushSetEntry(context, training, node);

			if (undefined !== entry) {
				indexSetEntry(set, entry);
			}
		}

		return set;
	}

	private async pushSetEntry(
		context: SyncPushContext,
		training: Training,
		node: PushTrainingPuzzleNodeDto,
	): Promise<TrainingPuzzle | undefined> {
		const existing = await context.entityManager.findOne(
			TrainingPuzzle,
			syncKey(node, 'trainingPuzzle'),
		);

		if (null !== existing) {
			const belongsHere = existing.training.uuid === training.uuid;

			return reuseSyncRow(context, 'trainingPuzzle', node, existing, belongsHere, OTHER_TREE);
		}

		const puzzle = context.puzzles.get(node.lichessId);

		if (undefined === puzzle) {
			context.outcome.reject('trainingPuzzle', node, `unknown puzzle \`${node.lichessId}\``);

			return undefined;
		}

		const entry = this.applySyncTimestampsUseCase.execute(
			new TrainingPuzzle({ training, puzzle }),
			node,
		);

		return claimSyncRow(context, 'trainingPuzzle', node, entry);
	}
}

function indexSetEntry(set: Map<string, TrainingPuzzle>, entry: TrainingPuzzle): void {
	set.set(entry.uuid, entry);

	if (undefined !== entry.clientRef) {
		set.set(entry.clientRef, entry);
	}
}

const OTHER_TREE = 'belongs to another training';
