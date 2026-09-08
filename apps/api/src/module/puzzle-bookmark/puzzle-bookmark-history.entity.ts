import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';
import { User } from '../user/user.entity';

import { PuzzleBookmarkType } from './definition/puzzle-bookmark-type.enum';

@Entity()
export class PuzzleBookmarkHistory extends CustomBaseEntity<PuzzleBookmarkHistory> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	user!: User;

	@ManyToOne(() => Puzzle, { deleteRule: 'cascade' })
	puzzle!: Puzzle;

	@Property({ type: 'string', nullable: true })
	type?: PuzzleBookmarkType;

	@Property({ type: 'string', nullable: true })
	attemptUuid?: string;
}
