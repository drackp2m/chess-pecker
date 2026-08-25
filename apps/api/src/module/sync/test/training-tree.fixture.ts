import { EntityManager } from '@mikro-orm/core';

import { GenerateUuidUseCase } from '../../../shared/use-case/generate-uuid.use-case';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { CalibrationRoundKind } from '../../training/definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../../training/definition/calibration-round-outcome.enum';
import { PuzzleAttemptClosure } from '../../training/definition/puzzle-attempt-closure.enum';
import { TrainingCycleStatus } from '../../training/definition/training-cycle-status.enum';
import { TrainingStatus } from '../../training/definition/training-status.enum';
import { User } from '../../user/user.entity';
import { PushAttemptNodeDto } from '../dto/request/push-attempt-node.dto';
import { PushCalibrationRoundNodeDto } from '../dto/request/push-calibration-round-node.dto';
import { PushCycleNodeDto } from '../dto/request/push-cycle-node.dto';
import { PushTrainingNodeDto } from '../dto/request/push-training-node.dto';
import { PushTrainingRequestDto } from '../dto/request/push-training-request.dto';

export type PlainNode<T> = { [K in keyof T]: T[K] };

export const CALIBRATION_PUZZLE = 'aaaaa';

export const SET_PUZZLE = 'bbbbb';

export const SPARE_PUZZLE = 'ccccc';

export const EXTRA_PUZZLE = 'ddddd';

export const UNKNOWN_PUZZLE = 'zzzzz';

export const CATALOG = [CALIBRATION_PUZZLE, SET_PUZZLE, SPARE_PUZZLE, EXTRA_PUZZLE];

export const BORN = new Date('2026-08-01T09:00:00.000Z');

export const CLOSED = new Date('2026-08-02T18:30:00.000Z');

export interface TreeRefs {
	training: string;
	goal: string;
	round: string;
	dealt: string;
	set: string;
	cycle: string;
	item: string;
	calibrationAttempt: string;
	cycleAttempt: string;
}

export function uuid(): string {
	return new GenerateUuidUseCase().execute();
}

export function buildRefs(): TreeRefs {
	return {
		training: uuid(),
		goal: uuid(),
		round: uuid(),
		dealt: uuid(),
		set: uuid(),
		cycle: uuid(),
		item: uuid(),
		calibrationAttempt: uuid(),
		cycleAttempt: uuid(),
	};
}

export function attemptNode(clientRef: string, lichessId: string): PlainNode<PushAttemptNodeDto> {
	return {
		clientRef,
		createdAt: BORN,
		updatedAt: CLOSED,
		lichessId,
		durationMs: 12_000,
		solved: true,
		closure: PuzzleAttemptClosure.Found,
		hintUsed: false,
		mistakeCount: 0,
		record: [],
		freePlayRuns: [],
	};
}

export function roundNode(refs: TreeRefs): PlainNode<PushCalibrationRoundNodeDto> {
	return {
		clientRef: refs.round,
		createdAt: BORN,
		updatedAt: CLOSED,
		index: 1,
		kind: CalibrationRoundKind.Exploration,
		rating: 1500,
		outcome: CalibrationRoundOutcome.Accept,
		puzzles: [
			{
				clientRef: refs.dealt,
				createdAt: BORN,
				updatedAt: BORN,
				lichessId: CALIBRATION_PUZZLE,
				position: 0,
			},
		],
		attempts: [attemptNode(refs.calibrationAttempt, CALIBRATION_PUZZLE)],
	};
}

export function cycleNode(refs: TreeRefs): PlainNode<PushCycleNodeDto> {
	return {
		clientRef: refs.cycle,
		createdAt: BORN,
		updatedAt: BORN,
		index: 1,
		status: TrainingCycleStatus.Running,
		itemCount: 1,
		items: [
			{
				clientRef: refs.item,
				createdAt: BORN,
				updatedAt: BORN,
				trainingPuzzleRef: refs.set,
				position: 0,
				attempts: [attemptNode(refs.cycleAttempt, SET_PUZZLE)],
			},
		],
	};
}

/**
 * A tree with one row per table, which is what makes a count mean anything: a push that
 * duplicated would duplicate in one of the eight.
 */
export function trainingNode(refs: TreeRefs): PlainNode<PushTrainingNodeDto> {
	return {
		clientRef: refs.training,
		createdAt: BORN,
		updatedAt: CLOSED,
		status: TrainingStatus.Running,
		goals: [{ clientRef: refs.goal, createdAt: BORN, updatedAt: BORN, puzzlesPerDay: 10 }],
		rounds: [roundNode(refs)],
		puzzles: [{ clientRef: refs.set, createdAt: BORN, updatedAt: BORN, lichessId: SET_PUZZLE }],
		cycles: [cycleNode(refs)],
	};
}

export function buildTree(refs: TreeRefs): PushTrainingRequestDto {
	return { training: trainingNode(refs) };
}

export async function seedUser(entityManager: EntityManager, username: string): Promise<User> {
	const em = entityManager.fork();
	const user = new User({ username, password: 'password' });

	em.persist(user);

	await em.flush();

	return user;
}

export async function resetTrainingFixtures(entityManager: EntityManager): Promise<User> {
	const em = entityManager.fork();

	await em.nativeDelete(User, {});
	await em.nativeDelete(Puzzle, {});

	for (const lichessId of CATALOG) {
		em.persist(
			new Puzzle({
				lichessId,
				fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
				moves: ['e2e4', 'e7e5'],
				rating: 1500,
				themes: ['fork'],
			}),
		);
	}

	await em.flush();

	return seedUser(entityManager, 'drackp2m');
}
