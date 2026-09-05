import type { GetTrainingAttemptsRequest } from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { toIsoDate } from '../../../shared/util/to-iso-date';
import {
	TrainingAttempt,
	TrainingAttemptHistory,
} from '../definition/training-attempt-history.interface';
import { TrainingPolicy } from '../definition/training-policy';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { Training } from '../training.entity';

@Injectable()
export class ListTrainingAttemptsUseCase {
	constructor(
		@Inject(PuzzleAttemptRepository)
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
	) {}

	/**
	 * The cut is the last row served and not a timestamp: two attempts can share an instant,
	 * and `uuid` completes the order. A full page only means there *may* be more.
	 */
	async execute(
		training: Training,
		request: GetTrainingAttemptsRequest,
	): Promise<TrainingAttemptHistory> {
		const size = Math.min(request.limit ?? PAGE_SIZE, PAGE_SIZE);
		const after = toCursor(request.since);
		const attempts = await this.puzzleAttemptRepository.getPageByTraining(
			training.uuid,
			size,
			after,
		);

		return {
			attempts: attempts.map((attempt) => toHistoryEntry(attempt)),
			cursor: attempts.at(-1)?.uuid ?? after ?? '',
			hasMore: attempts.length === size,
		};
	}
}

const PAGE_SIZE = TrainingPolicy.attemptPageSize;

/** A blank cursor brings none: the device starts from the beginning. */
function toCursor(since?: string): string | undefined {
	const cursor = since?.trim();

	return undefined === cursor || 0 === cursor.length ? undefined : cursor;
}

/**
 * The slot it belongs to: one of the two and never both, which the table's `check` enforces.
 * Read with `?.` because an empty relation comes back as `null`.
 */
function toHistoryEntry(attempt: PuzzleAttempt): TrainingAttempt {
	const roundUuid = attempt.calibrationRound?.uuid;
	const cycleItemUuid = attempt.cycleItem?.uuid;
	const position = attempt.cycleItem?.position;

	return {
		uuid: attempt.uuid,
		kind: attempt.kind,
		puzzle: attempt.puzzle,
		durationMs: attempt.durationMs,
		solved: attempt.solved,
		closure: attempt.closure,
		hintUsed: attempt.hintUsed,
		mistakeCount: attempt.mistakeCount,
		record: attempt.record,
		freePlayRuns: attempt.freePlayRuns,
		createdAt: toIsoDate(attempt.createdAt),
		updatedAt: toIsoDate(attempt.updatedAt),
		...(undefined === roundUuid ? {} : { roundUuid }),
		...(undefined === cycleItemUuid ? {} : { cycleItemUuid }),
		...(undefined === position ? {} : { position }),
	};
}
