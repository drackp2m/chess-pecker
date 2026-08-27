import { Entity, Enum, ManyToOne, Property, Unique } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { PuzzleAttemptClosure } from '../training/definition/puzzle-attempt-closure.enum';
import { User } from '../user/user.entity';

import { PuzzleShareAttemptRepository } from './puzzle-share-attempt.repository';
import { PuzzleShare } from './puzzle-share.entity';

/**
 * What one participant made of a challenge, sender included. It is not a `puzzle_attempt`:
 * that table hangs off a training by a check constraint and travels in the sync tree, and a
 * challenge has neither. The columns are the same ones so the two read alike.
 *
 * One row per participant: the verdict is settled on the first try, so answering twice is
 * refused rather than recorded.
 */
@Entity({ repository: () => PuzzleShareAttemptRepository })
@Unique({ properties: ['share', 'user'] })
export class PuzzleShareAttempt extends CustomBaseEntity<PuzzleShareAttempt> {
	@ManyToOne(() => PuzzleShare, { deleteRule: 'cascade' })
	share!: PuzzleShare;

	@ManyToOne(() => User, { deleteRule: 'cascade' })
	user!: User;

	@Property()
	solved!: boolean;

	@Enum({ items: () => PuzzleAttemptClosure })
	closure!: PuzzleAttemptClosure;

	@Property({ default: false })
	hintUsed!: boolean;

	@Property({ default: 0 })
	mistakeCount!: number;

	/** Only a training runs a clock, so an answer from anywhere else has no time to report. */
	@Property({ nullable: true })
	durationMs?: number;
}
