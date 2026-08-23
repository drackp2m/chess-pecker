import { Injectable } from '@nestjs/common';

import { BadRequestException } from '../../../shared/exception/bad-request.exception';
import { CustomBaseEntity } from '../../../shared/util/custom-base.entity';
import { SyncTimestampsDto } from '../dto/request/sync-timestamps.dto';

@Injectable()
export class ApplySyncTimestampsUseCase {
	/** Slack for client clocks running slightly fast. */
	private static readonly futureToleranceMs = 5 * 60 * 1000;

	/**
	 * The user owns the clock, so incoming dates get a sanity check. Enough while the stats
	 * are personal; comparing them against a friend's would need server stamps.
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
