import { Entity, Property, Unique } from '@mikro-orm/decorators/legacy';

import { GenerateNowDateUseCase } from '../use-case/generate-now-date.use-case';

import { CustomBaseEntity } from './custom-base.entity';

/**
 * What a table needs to be the remote replica of one living on a device: `clientRef`, the
 * retry key a push looks up before inserting, and `receivedAt`, the only server clock here.
 */
@Entity({ abstract: true })
export abstract class SyncableBaseEntity<
	T extends SyncableBaseEntity<T>,
> extends CustomBaseEntity<T> {
	@Unique()
	@Property({ type: 'string', nullable: true })
	clientRef?: string;

	@Property({
		type: 'datetime',
		defaultRaw: 'now()',
		onUpdate: () => new GenerateNowDateUseCase().execute(),
	})
	receivedAt: Date = new GenerateNowDateUseCase().execute();
}
