import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { UserBlock } from './user-block.entity';

export class UserBlockRepository extends CustomRepository<UserBlock> {
	/** Bloqueo en cualquiera de los dos sentidos: cualquiera de los dos corta la relación. */
	async existsBetween(oneUuid: string, otherUuid: string): Promise<boolean> {
		const blocks = await this.getMany({
			$or: [
				{ blocker: oneUuid, blocked: otherUuid },
				{ blocker: otherUuid, blocked: oneUuid },
			],
		});

		return 0 < blocks.length;
	}
}
