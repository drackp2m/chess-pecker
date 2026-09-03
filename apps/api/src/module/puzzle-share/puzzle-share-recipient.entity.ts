import { Entity, Index, ManyToOne, Unique } from '@mikro-orm/decorators/es';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { User } from '../user/user.entity';

import { PuzzleShareRecipientRepository } from './puzzle-share-recipient.repository';
import { PuzzleShare } from './puzzle-share.entity';

/** Somebody a challenge was sent to. Naming the same friend twice moves nothing. */
@Entity({ repository: () => PuzzleShareRecipientRepository })
@Unique({ properties: ['share', 'recipient'] })
@Index({ properties: ['recipient', 'createdAt'] })
export class PuzzleShareRecipient extends CustomBaseEntity<PuzzleShareRecipient> {
	@ManyToOne(() => PuzzleShare, { deleteRule: 'cascade' })
	share!: PuzzleShare;

	@ManyToOne(() => User, { deleteRule: 'cascade' })
	recipient!: User;
}
