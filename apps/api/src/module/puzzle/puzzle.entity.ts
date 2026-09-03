import { Entity, Index, Property } from '@mikro-orm/decorators/es';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';

import { PuzzleRepository } from './puzzle.repository';

/**
 * Global exercise catalogue. `lichessId` is the natural key the import upserts on, and the
 * reference the front sends: the uuids a browser invented for a local CSV are not ours.
 */
@Entity({ repository: () => PuzzleRepository })
export class Puzzle extends CustomBaseEntity<Puzzle> {
	@Property({ unique: true })
	lichessId!: string;

	/** The position *before* the opponent's move. */
	@Property({ type: 'text' })
	fen!: string;

	/** UCI; `moves[0]` is the opponent's move, replayed when the exercise opens. */
	@Property({ type: 'string[]' })
	moves!: string[];

	/** Lichess' exact ELO. The hundred band is `rating / 100`, and is not stored. */
	@Index()
	@Property()
	rating!: number;

	@Index({ type: 'gin' })
	@Property({ type: 'string[]' })
	themes!: string[];
}
