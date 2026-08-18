import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PushTrainingResult } from '@chesspecker/api-definitions';

import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SyncRepository } from '@app/repository/sync.repository';
import { RekeyUseCase } from '@app/use-case/sync/rekey.use-case';
import {
	NOTHING_SETTLED,
	SyncConfirmCount,
	SyncConfirmUseCase,
	addSettled,
} from '@app/use-case/sync/sync-confirm.use-case';
import { TrainingTreePush, TrainingTreeUseCase } from '@app/use-case/sync/training-tree.use-case';
import { HttpError } from '@app/util/http-error';

export interface SyncPushReport {
	readonly confirmed: number;
	readonly rejected: number;
	/** Entrenamientos que siguen con algo por subir cuando la pasada termina. */
	readonly pendingTrainings: number;
	/** Se cortó por algo pasajero: la red, un 5xx o una petición que no llegó a volver. */
	readonly interrupted: boolean;
}

type PushAnswer =
	| { readonly kind: 'answered'; readonly result: PushTrainingResult }
	| { readonly kind: 'refused'; readonly reason: string }
	| { readonly kind: 'unreachable' };

interface PushOutcome {
	readonly settled: SyncConfirmCount;
	readonly interrupted: boolean;
}

interface PushPass extends PushOutcome {
	/** El uuid definitivo del entrenamiento, si esta petición es la que se lo acaba de dar. */
	readonly trainingUuid: string | undefined;
}

/**
 * Un 4xx sobre el árbol entero no es un choque de datos: es una petición que el servidor no
 * va a aceptar nunca, y reintentarla sería girar en el sitio para siempre.
 */
const REFUSING_STATUS = new Set([400, 403, 409, 422]);

/**
 * Todo lo que se escribió aquí y no está arriba, subido solo.
 *
 * La unidad es el árbol de un entrenamiento y no la fila, y una subida cortada se repite sin
 * miedo: el servidor busca por la clave de reintento antes de insertar, así que lo que ya
 * entró vuelve con el uuid que tiene en vez de duplicarse.
 */
@Injectable({
	providedIn: 'root',
})
export class SyncPushUseCase {
	private readonly trees = inject(TrainingTreeUseCase);
	private readonly remote = inject(SyncRepository);
	private readonly rekey = inject(RekeyUseCase);
	private readonly confirmer = inject(SyncConfirmUseCase);

	async execute(): Promise<SyncPushReport> {
		let settled = NOTHING_SETTLED;
		let interrupted = false;

		for (const trainingUuid of await this.trees.listPending()) {
			const outcome = await this.pushTraining(trainingUuid);

			settled = addSettled(settled, outcome.settled);

			// La red no vuelve para el árbol siguiente: lo que queda espera a la pasada que viene.
			if (outcome.interrupted) {
				interrupted = true;

				break;
			}
		}

		const pending = await this.trees.listPending();

		return { ...settled, pendingTrainings: pending.length, interrupted };
	}

	/** Un árbol, en tantas peticiones como haga falta: lo que no cabe en una va en la siguiente. */
	private async pushTraining(uuid: string): Promise<PushOutcome> {
		let trainingUuid = uuid;
		let settled = NOTHING_SETTLED;

		for (let request = 0; request < SyncPolicy.maxRequestsPerRun; request += 1) {
			const push = await this.trees.build(trainingUuid);

			if (undefined === push) {
				break;
			}

			const pass = await this.pushOnce(push);

			settled = addSettled(settled, pass.settled);
			trainingUuid = pass.trainingUuid ?? trainingUuid;

			// Sin una sola fila sellada ni rechazada, volver a mandar lo mismo daría lo mismo.
			if (pass.interrupted || 0 === pass.settled.confirmed + pass.settled.rejected) {
				return { settled, interrupted: pass.interrupted };
			}
		}

		return { settled, interrupted: false };
	}

	private async pushOnce(push: TrainingTreePush): Promise<PushPass> {
		const answer = await this.send(push);

		if ('unreachable' === answer.kind) {
			return { settled: NOTHING_SETTLED, interrupted: true, trainingUuid: undefined };
		}

		if ('refused' === answer.kind) {
			const settled = await this.confirmer.rejectAll(push, answer.reason);

			return { settled, interrupted: false, trainingUuid: undefined };
		}

		// Las claves antes que los sellos: sellar una fila que todavía no se ha movido la
		// dejaría al servidor con un uuid y aquí con otro.
		await this.rekey.execute(push.trainingUuid, answer.result.uuids);

		return {
			settled: await this.confirmer.execute(push, answer.result),
			interrupted: false,
			trainingUuid: answer.result.uuids.training[push.trainingUuid],
		};
	}

	private async send(push: TrainingTreePush): Promise<PushAnswer> {
		for (let attempt = 0; attempt <= SyncPolicy.retryBackoffMs.length; attempt += 1) {
			try {
				return { kind: 'answered', result: await this.remote.pushTraining(push.request) };
			} catch (error) {
				const reason = toRefusal(error);

				if (undefined !== reason) {
					return { kind: 'refused', reason };
				}

				const backoff = SyncPolicy.retryBackoffMs[attempt];

				if (undefined !== backoff) {
					await wait(backoff);
				}
			}
		}

		return { kind: 'unreachable' };
	}
}

function toRefusal(error: unknown): string | undefined {
	if (!(error instanceof HttpErrorResponse) || !REFUSING_STATUS.has(error.status)) {
		return undefined;
	}

	return HttpError.toFailure(error) ?? `HTTP ${error.status.toString()}`;
}

function wait(delay: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, delay);
	});
}
