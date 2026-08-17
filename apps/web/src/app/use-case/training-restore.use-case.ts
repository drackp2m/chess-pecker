import { Injectable, inject } from '@angular/core';
import type { TrainingAttempt } from '@chesspecker/api-definitions';

import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { TrainingRepository } from '@app/repository/training.repository';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';

/** Tope de páginas por visita: un dispositivo vacío termina de llenarse en la siguiente. */
const MAX_PAGES = 20;

/**
 * Vuelve a bajar el histórico que el dispositivo no tiene. Lo local manda —lo que ya está
 * aquí no se toca nunca—, así que esto sólo rellena huecos: los ejercicios resueltos en
 * otro dispositivo, o los que se fueron al vaciar el aparato.
 *
 * El intento se reconoce por el hueco del plan que ocupa y no por su fila: el uuid lo pone
 * cada lado por su cuenta y no viaja, así que casar por él duplicaría.
 */
@Injectable({
	providedIn: 'root',
})
export class TrainingRestoreUseCase {
	private readonly remote = inject(TrainingRepository);
	private readonly repository = inject(TrainingLocalRepository);
	private readonly puzzleCache = inject(PuzzleCacheUseCase);

	/**
	 * Silencioso a propósito: no poder restaurar no puede tumbar el ciclo de sincronización.
	 * Devuelve si el histórico quedó entero —lo que quede a medias se termina en la pasada
	 * siguiente, porque el cursor sólo avanza con la página ya guardada—, y es lo que decide
	 * si el corte global de `attempt` se puede adelantar.
	 */
	async execute(trainingUuid: string): Promise<boolean> {
		return this.download(trainingUuid).catch(() => false);
	}

	private async download(trainingUuid: string): Promise<boolean> {
		let since = (await this.repository.find('attemptCursor', trainingUuid))?.cursor;

		for (let page = 0; page < MAX_PAGES; page += 1) {
			const history = await this.remote.listAttempts(
				trainingUuid,
				undefined === since ? {} : { since },
			);

			await this.puzzleCache.save(history.attempts.map((attempt) => attempt.puzzle));
			await this.absorb(trainingUuid, history.attempts);

			since = history.cursor;

			await this.repository.insert('attemptCursor', {
				trainingUuid,
				cursor: history.cursor,
				updatedAt: new Date(),
			});

			if (!history.hasMore) {
				return true;
			}
		}

		return false;
	}

	private async absorb(trainingUuid: string, attempts: readonly TrainingAttempt[]): Promise<void> {
		for (const attempt of attempts) {
			const row = this.toRow(trainingUuid, attempt);
			const stored = await this.findBySlot(row);

			if (undefined === stored) {
				await this.repository.insert('attempt', row);

				continue;
			}

			// Lo de aquí no se pisa, pero un hueco sí se rellena: la posición no la sabía la
			// fila que se escribió antes de que el servidor la mandara.
			if (undefined === stored.position && undefined !== row.position) {
				await this.repository.insert('attempt', { ...stored, position: row.position });
			}
		}
	}

	private async findBySlot(row: AttemptRow): Promise<AttemptRow | undefined> {
		if (undefined !== row.cycleItemUuid) {
			return this.repository.findByIndex('attempt', 'cycleItemUuid', row.cycleItemUuid);
		}

		if (undefined === row.roundUuid) {
			return undefined;
		}

		return this.repository.findByIndex('attempt', 'roundUuid-puzzleUuid', [
			row.roundUuid,
			row.puzzleUuid,
		]);
	}

	private toRow(trainingUuid: string, attempt: TrainingAttempt): AttemptRow {
		const identity = {
			trainingUuid,
			kind: attempt.kind,
			puzzleUuid: attempt.puzzle.uuid,
			lichessId: attempt.puzzle.lichessId,
			...(undefined === attempt.roundUuid ? {} : { roundUuid: attempt.roundUuid }),
			...(undefined === attempt.cycleItemUuid ? {} : { cycleItemUuid: attempt.cycleItemUuid }),
		};

		return {
			...identity,
			uuid: attempt.uuid,
			durationMs: attempt.durationMs,
			record: attempt.record,
			explorations: attempt.explorations,
			solved: attempt.solved,
			closure: attempt.closure,
			hintUsed: attempt.hintUsed,
			mistakeCount: attempt.mistakeCount,
			createdAt: new Date(attempt.createdAt),
			updatedAt: new Date(attempt.updatedAt),
			...(undefined === attempt.position ? {} : { position: attempt.position }),
			// Viene del servidor, así que nunca es lo único que hay: no cuenta como pendiente.
			syncedAt: new Date(),
		};
	}
}
