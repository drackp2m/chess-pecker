import { Injectable } from '@nestjs/common';

import { BadRequestException } from '../../../shared/exception/bad-request.exception';
import { CustomBaseEntity } from '../../../shared/util/custom-base.entity';
import { SyncTimestampsDto } from '../dto/request/sync-timestamps.dto';

@Injectable()
export class ApplySyncTimestampsUseCase {
	/** Margen para relojes de cliente que van algo adelantados. */
	private static readonly futureToleranceMs = 5 * 60 * 1000;

	/**
	 * El reloj lo pone el usuario, así que las fechas que llegan pasan por una comprobación
	 * de cordura antes de escribirse. Mientras las estadísticas sean personales esto basta;
	 * si algún día se comparan con las de un amigo, harán falta marcas del servidor porque
	 * las del cliente son falsificables.
	 */
	execute<T extends CustomBaseEntity<T>>(entity: T, timestamps: SyncTimestampsDto): T {
		const now = Date.now();
		const limit = now + ApplySyncTimestampsUseCase.futureToleranceMs;

		if (undefined !== timestamps.createdAt) {
			if (timestamps.createdAt.getTime() > limit) {
				throw new BadRequestException('cannot be in the future', 'createdAt');
			}

			entity.createdAt = timestamps.createdAt;
		}

		if (undefined !== timestamps.updatedAt) {
			if (timestamps.updatedAt.getTime() > limit) {
				throw new BadRequestException('cannot be in the future', 'updatedAt');
			}

			if (timestamps.updatedAt.getTime() < entity.createdAt.getTime()) {
				throw new BadRequestException('cannot be before createdAt', 'updatedAt');
			}

			entity.updatedAt = timestamps.updatedAt;
		}

		return entity;
	}
}
