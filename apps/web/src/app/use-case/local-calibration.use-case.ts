import { Injectable, inject } from '@angular/core';
import type { CalibrationRoundOutcome } from '@chesspecker/api-definitions';

import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	CalibrationPuzzleRow,
	CalibrationRoundRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';
import { born, touch } from '@app/use-case/sync/local-record';
import {
	resolveNextRound,
	resolveRoundOutcome,
	roundPuzzleCount,
} from '@app/util/calibration-plan';
import { ratingBucketCeiling } from '@app/util/rating-bucket';

export interface LocalCalibrationRoundStart {
	readonly round: CalibrationRoundRow;
	readonly puzzles: readonly PuzzleRow[];
}

export interface LocalCalibrationRoundPuzzles {
	readonly total: number;
	readonly attempted: number;
	readonly puzzles: readonly PuzzleRow[];
}

@Injectable({
	providedIn: 'root',
})
export class LocalCalibrationUseCase {
	private readonly repository = inject(TrainingLocalRepository);
	private readonly trainings = inject(LocalTrainingUseCase);

	async listRounds(trainingUuid: string): Promise<readonly CalibrationRoundRow[]> {
		const rows = await this.repository.findAllByIndex(
			'calibrationRound',
			'trainingUuid',
			trainingUuid,
		);

		return rows.sort((left, right) => left.index - right.index);
	}

	async findAcceptedRound(trainingUuid: string): Promise<CalibrationRoundRow | undefined> {
		return (await this.listRounds(trainingUuid)).find((round) => 'accept' === round.outcome);
	}

	async createRound(trainingUuid: string): Promise<LocalCalibrationRoundStart> {
		const training = await this.trainings.find(trainingUuid);

		if ('calibrating' !== training?.status) {
			throw new Error('The training is not calibrating');
		}

		const rounds = await this.listRounds(trainingUuid);

		if ('pending' === rounds.at(-1)?.outcome) {
			throw new Error('A calibration round is already in progress');
		}

		const { kind, rating } = resolveNextRound(rounds);
		const puzzles = await this.dealPuzzles(kind, rating);
		const round = await this.insertRound(trainingUuid, rounds.length + 1, kind, rating);

		await this.repository.batchInsert('calibrationPuzzle', this.toDealtRows(round, puzzles));

		return { round, puzzles };
	}

	async listRoundPuzzles(roundUuid: string): Promise<LocalCalibrationRoundPuzzles> {
		const round = await this.repository.find('calibrationRound', roundUuid);

		if (undefined === round) {
			throw new Error('Unknown calibration round');
		}

		const dealt = await this.listDealt(roundUuid);
		const attempted = new Set(
			(await this.roundAttempts(round)).map((attempt) => attempt.lichessId),
		);
		const pending = dealt.filter((row) => !attempted.has(row.lichessId));

		return {
			total: dealt.length,
			attempted: dealt.length - pending.length,
			puzzles: await this.toPuzzles(pending),
		};
	}

	async closeIfComplete(roundUuid: string): Promise<CalibrationRoundOutcome> {
		const round = await this.repository.find('calibrationRound', roundUuid);

		if (undefined === round) {
			throw new Error('Unknown calibration round');
		}

		if ('pending' !== round.outcome) {
			return round.outcome;
		}

		const dealt = await this.listDealt(roundUuid);
		const attempts = await this.roundAttempts(round);

		if (attempts.length < dealt.length) {
			return 'pending';
		}

		return this.close(round, attempts);
	}

	private async close(
		round: CalibrationRoundRow,
		attempts: readonly AttemptRow[],
	): Promise<CalibrationRoundOutcome> {
		const rounds = await this.listRounds(round.trainingUuid);
		const outcome = resolveRoundOutcome(
			round,
			attempts,
			rounds.filter((other) => other.uuid !== round.uuid),
		);

		await this.repository.insert(
			'calibrationRound',
			touch<CalibrationRoundRow>({ ...round, outcome }),
		);

		if ('accept' === outcome) {
			await this.trainings.updateStatus(round.trainingUuid, 'planning');
		}

		return outcome;
	}

	private async dealPuzzles(
		kind: 'exploration' | 'refine',
		rating: number,
	): Promise<readonly PuzzleRow[]> {
		const size = roundPuzzleCount(kind);
		const puzzles = await this.repository.sampleByRating(rating, ratingBucketCeiling(rating), size);

		if (puzzles.length < size) {
			throw new Error('Not enough local puzzles in that rating band');
		}

		return puzzles;
	}

	private async insertRound(
		trainingUuid: string,
		index: number,
		kind: 'exploration' | 'refine',
		rating: number,
	): Promise<CalibrationRoundRow> {
		const now = new Date();

		return this.repository.insert(
			'calibrationRound',
			born<CalibrationRoundRow>({
				uuid: crypto.randomUUID(),
				trainingUuid,
				index,
				kind,
				rating,
				outcome: 'pending',
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	private toDealtRows(
		round: CalibrationRoundRow,
		puzzles: readonly PuzzleRow[],
	): CalibrationPuzzleRow[] {
		const now = new Date();

		return puzzles.map((puzzle, position) =>
			born<CalibrationPuzzleRow>({
				uuid: crypto.randomUUID(),
				roundUuid: round.uuid,
				lichessId: puzzle.lichessId,
				position,
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	private async listDealt(roundUuid: string): Promise<readonly CalibrationPuzzleRow[]> {
		const rows = await this.repository.findAllByIndex('calibrationPuzzle', 'roundUuid', roundUuid);

		return rows.sort((left, right) => left.position - right.position);
	}

	private async roundAttempts(round: CalibrationRoundRow): Promise<readonly AttemptRow[]> {
		const rows = await this.repository.findAllByIndex(
			'attempt',
			'trainingUuid',
			round.trainingUuid,
		);

		return rows.filter((row) => round.uuid === row.roundUuid);
	}

	private async toPuzzles(rows: readonly CalibrationPuzzleRow[]): Promise<readonly PuzzleRow[]> {
		const puzzles = await Promise.all(
			rows.map((row) => this.repository.find('puzzle', row.lichessId)),
		);

		return puzzles.filter((puzzle): puzzle is PuzzleRow => undefined !== puzzle);
	}
}
