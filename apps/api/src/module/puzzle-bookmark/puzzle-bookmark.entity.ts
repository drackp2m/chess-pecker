import { Entity, Enum, ManyToOne, Unique } from '@mikro-orm/decorators/legacy';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';
import { User } from '../user/user.entity';

import { PuzzleBookmarkType } from './definition/puzzle-bookmark-type.enum';
import { PuzzleBookmarkRepository } from './puzzle-bookmark.repository';

/**
 * The list a user filed an exercise under. One row per pair: filing it again moves it, so
 * an exercise is never in two lists at once.
 */
@Entity({ repository: () => PuzzleBookmarkRepository })
@Unique({ properties: ['user', 'puzzle'] })
export class PuzzleBookmark extends CustomBaseEntity<PuzzleBookmark> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	user!: User;

	@ManyToOne(() => Puzzle, { deleteRule: 'cascade' })
	puzzle!: Puzzle;

	@Enum({ items: () => PuzzleBookmarkType })
	type!: PuzzleBookmarkType;
}
