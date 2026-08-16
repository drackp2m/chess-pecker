import { Injectable } from '@nestjs/common';

import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import {
	TrainingAttempt,
	TrainingAttemptHistory,
} from '../definition/training-attempt-history.interface';
import { TrainingPolicy } from '../definition/training-policy';
import { GetTrainingAttemptsRequestDto } from '../dto/request/get-training-attempts-request.dto';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { Training } from '../training.entity';

@Injectable()
export class ListTrainingAttemptsUseCase {
	constructor(private readonly puzzleAttemptRepository: PuzzleAttemptRepository) {}

	/**
	 * El corte se lee antes que las filas, igual que en la actividad: lo que entre entre las
	 * dos consultas viaja ya en la siguiente página o en la siguiente visita. Repetir un
	 * intento es gratis —el dispositivo lo reconoce por su hueco—, perdérselo no.
	 *
	 * Una página llena no dice que queden más, dice que puede que queden: el cliente pide
	 * otra y se encuentra con que está vacía, que es una petición de más y ninguna fila de
	 * menos.
	 */
	async execute(
		training: Training,
		request: GetTrainingAttemptsRequestDto,
	): Promise<TrainingAttemptHistory> {
		const size = Math.min(request.limit ?? TrainingPolicy.attemptPageSize, PAGE_SIZE);
		const received =
			(await this.puzzleAttemptRepository.lastReceivedAtByTraining(training.uuid)) ??
			new GenerateNowDateUseCase().execute();

		const attempts = await this.puzzleAttemptRepository.getManyByTrainingReceivedAfter(
			training.uuid,
			size,
			request.since,
		);

		const hasMore = attempts.length === size;

		return {
			attempts: attempts.map((attempt) => toHistoryEntry(attempt)),
			cursor: (hasMore ? endOfPage(attempts, received) : received).toISOString(),
			hasMore,
		};
	}
}

const PAGE_SIZE = TrainingPolicy.attemptPageSize;

/** Dónde acaba la página, que es por donde sigue la siguiente. */
function endOfPage(attempts: PuzzleAttempt[], fallback: Date): Date {
	return attempts.at(-1)?.receivedAt ?? fallback;
}

/**
 * El hueco al que pertenece: uno de los dos, nunca los dos, que es lo que garantiza el
 * `check` de la tabla. Se lee con `?.` porque una relación vacía vuelve de la base como
 * `null` y el tipo la declara opcional.
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
		explorations: attempt.explorations,
		createdAt: attempt.createdAt.toISOString(),
		updatedAt: attempt.updatedAt.toISOString(),
		...(undefined === roundUuid ? {} : { roundUuid }),
		...(undefined === cycleItemUuid ? {} : { cycleItemUuid }),
		...(undefined === position ? {} : { position }),
	};
}
