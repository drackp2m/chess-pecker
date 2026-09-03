import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';
import { PuzzleAttempt } from '../training/puzzle-attempt.entity';
import { User } from '../user/user.entity';

import { PuzzleShareRepository } from './puzzle-share.repository';

/**
 * One exercise handed to friends as a challenge. Who it went to is a table of its own, so
 * sending it to five people is one challenge with five rows and not five challenges.
 */
@Entity({ repository: () => PuzzleShareRepository })
@Index({ properties: ['sender', 'createdAt'] })
export class PuzzleShare extends CustomBaseEntity<PuzzleShare> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	sender!: User;

	@ManyToOne(() => Puzzle, { deleteRule: 'cascade' })
	puzzle!: Puzzle;

	@Property({ type: 'text', nullable: true })
	message?: string;

	/**
	 * The training attempt the challenge came out of, when there is one: an exercise solved
	 * off the standalone board records nothing, and one solved seconds ago may not have been
	 * pushed yet. The sender's numbers do not depend on it — they have a row of their own.
	 */
	@ManyToOne(() => PuzzleAttempt, { deleteRule: 'set null', nullable: true })
	sourceAttempt?: PuzzleAttempt;
}
