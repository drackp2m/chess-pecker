import { Injectable, inject } from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { ActivityRepository } from '@app/repository/activity.repository';
import { ActivityDayRow } from '@app/repository/definition/activity-schema.interface';
import { TrainingRepository } from '@app/repository/training.repository';
import { fillActivityDays } from '@app/util/activity-day';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { addUtcDays, diffUtcDays, toIsoDate, utcMidnight } from '@app/util/utc-date';

/**
 * El tope que aplica `TrainingPolicy.activityMaxDays` en el API, repetido aquí a mano.
 * Pedir por encima devolvería un tramo más corto del que se guardaría, y los días de más
 * quedarían archivados como vacíos sin haberlos preguntado nunca.
 */
const API_MAX_RANGE_DAYS = 53 * 7;

export interface ActivityHistory {
	readonly days: readonly TrainingActivityDay[];
	/** No se pudo traer lo nuevo: lo que va dentro es sólo lo que había guardado. */
	readonly isStale: boolean;
}

@Injectable({
	providedIn: 'root',
})
export class ActivityHistoryUseCase {
	private readonly activityRepository = inject(ActivityRepository);
	private readonly trainingRepository = inject(TrainingRepository);

	/**
	 * El desglose diario de los últimos `rangeDays` días, local primero.
	 *
	 * Lo guardado es siempre un tramo seguido que acaba hoy, así que basta contar cuántos
	 * días de ese tramo hay para saber si tiene huecos. Con huecos se pide entero; sin
	 * ellos se pregunta por el cursor, y sólo vuelven los días que hayan recibido algo
	 * después —de este dispositivo o de cualquier otro—. Si el rango pedido es más ancho
	 * que lo guardado, manda el ancho: el cursor sólo puede avanzar cubriendo todo lo que
	 * hay, o un día viejo se quedaría mal para siempre.
	 */
	async read(rangeDays: number, today: Date = new Date()): Promise<ActivityHistory> {
		const to = utcMidnight(today);
		const wantedFrom = addUtcDays(to, -(Math.min(rangeDays, API_MAX_RANGE_DAYS) - 1));
		const from = await this.keptFrom(wantedFrom);
		const isStale = await this.refresh(from, to);

		const days = await this.activityRepository.findRange(toIsoDate(wantedFrom), toIsoDate(to));

		return { days: fillActivityDays(days, wantedFrom, to), isStale };
	}

	/** El tramo que hay que mantener al día: lo guardado y lo pedido, lo que abarque más. */
	private async keptFrom(wantedFrom: Date): Promise<Date> {
		const firstDate = await this.activityRepository.firstDate();

		if (undefined === firstDate) {
			return wantedFrom;
		}

		const first = utcMidnight(new Date(firstDate));

		return first < wantedFrom ? first : wantedFrom;
	}

	private async refresh(from: Date, to: Date): Promise<boolean> {
		const days = diffUtcDays(from, to) + 1;
		const stored = await this.activityRepository.countRange(toIsoDate(from), toIsoDate(to));
		const cursor = await this.activityRepository.findCursor();

		try {
			await (stored < days || null === cursor
				? this.pullWhole(from, to, days)
				: this.pullChanges(days, cursor));

			return false;
		} catch (error) {
			return !ApiCancelledError.is(error);
		}
	}

	/**
	 * El tramo se guarda completo, con los días vacíos a cero incluidos: el API sólo
	 * devuelve los días con actividad, y sin esa marca no habría forma de distinguir
	 * después un día en blanco de uno que nunca se pidió.
	 */
	private async pullWhole(from: Date, to: Date, days: number): Promise<void> {
		const activity = await this.trainingRepository.getActivity(days);

		await this.activityRepository.saveAll(fillActivityDays(activity.days, from, to).map(toRow));
		await this.activityRepository.saveCursor(activity.cursor);
	}

	/**
	 * Sólo llegan los días tocados, y sólo ellos se reescriben: un día que no viene es un
	 * día que sigue valiendo. Ninguno puede quedarse vacío por el camino, porque los
	 * intentos no se borran.
	 */
	private async pullChanges(days: number, cursor: string): Promise<void> {
		const activity = await this.trainingRepository.getActivity(days, cursor);

		await this.activityRepository.saveAll(activity.days.map(toRow));
		await this.activityRepository.saveCursor(activity.cursor);
	}
}

function toRow(day: TrainingActivityDay): ActivityDayRow {
	const now = new Date();

	return { ...day, createdAt: now, updatedAt: now };
}
