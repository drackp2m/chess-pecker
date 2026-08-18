import { Injectable } from '@nestjs/common';

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
	 * El corte es la última fila servida, no una marca de tiempo: dos intentos pueden
	 * compartir el instante en que llegaron —los sube un mismo push, o los sella de golpe la
	 * migración que añadió `receivedAt`— y entre dos fechas iguales no hay por dónde cortar.
	 * Con la fila, sí: el orden se completa con el `uuid` y la página siguiente empieza justo
	 * después de la anterior, aunque las 500 que quedan lleven todas la misma fecha.
	 *
	 * Una página llena no dice que queden más, dice que puede que queden: el cliente pide
	 * otra y se encuentra con que está vacía, que es una petición de más y ninguna fila de
	 * menos. Y una vacía devuelve el cursor que le dieron, porque nada ha avanzado.
	 */
	async execute(
		training: Training,
		request: GetTrainingAttemptsRequestDto,
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

/** Un cursor en blanco es no traer ninguno: el dispositivo empieza por el principio. */
function toCursor(since?: string): string | undefined {
	const cursor = since?.trim();

	return undefined === cursor || 0 === cursor.length ? undefined : cursor;
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
