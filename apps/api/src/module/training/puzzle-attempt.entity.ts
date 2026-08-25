import type { FreePlayRun, PuzzleEvent } from '@chesspecker/api-definitions';
import { Check, Entity, Enum, Index, ManyToOne, Property } from '@mikro-orm/core';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';

import { PuzzleAttemptClosure } from './definition/puzzle-attempt-closure.enum';
import { PuzzleAttemptKind } from './definition/puzzle-attempt-kind.enum';
import { PuzzleAttemptRepository } from './puzzle-attempt.repository';
import { TrainingCalibrationRound } from './training-calibration-round.entity';
import { TrainingCycleItem } from './training-cycle-item.entity';
import { Training } from './training.entity';

/**
 * A finished exercise, in calibration as in a cycle. Append-only: nothing is sent until the
 * solution is out, so the server never sees a half-attempt and the row is written once.
 */
@Entity({ repository: () => PuzzleAttemptRepository })
@Index({ properties: ['training', 'kind'] })
@Index({ properties: ['puzzle', 'training'] })
@Index({ properties: ['training', 'receivedAt', 'uuid'] })
@Check({
	name: 'puzzle_attempt_kind_parent_check',
	expression: `(kind = 'calibration' and calibration_round_uuid is not null and cycle_item_uuid is null) or (kind = 'cycle' and cycle_item_uuid is not null and calibration_round_uuid is null)`,
})
export class PuzzleAttempt extends SyncableBaseEntity<PuzzleAttempt> {
	/** Denormalized on purpose: it saves a join on every progress query. */
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	@Enum({ items: () => PuzzleAttemptKind })
	kind!: PuzzleAttemptKind;

	@ManyToOne(() => TrainingCalibrationRound, { deleteRule: 'cascade', nullable: true })
	calibrationRound?: TrainingCalibrationRound;

	@Index()
	@ManyToOne(() => TrainingCycleItem, { deleteRule: 'cascade', nullable: true })
	cycleItem?: TrainingCycleItem;

	@ManyToOne(() => Puzzle)
	puzzle!: Puzzle;

	/** Time accumulated with the exercise on screen, not the gap between two dates. */
	@Property()
	durationMs!: number;

	/** Judged on the first try, so `false` is final however long the search goes on. */
	@Property()
	solved!: boolean;

	/** What that search came to: found, or given up on. */
	@Enum({ items: () => PuzzleAttemptClosure })
	closure!: PuzzleAttemptClosure;

	@Property({ default: false })
	hintUsed!: boolean;

	@Property({ default: 0 })
	mistakeCount!: number;

	/**
	 * Deliberately uninitialized: a default is written after `super()` and would overwrite
	 * what the base constructor just assigned. The column supplies it instead.
	 */
	@Property({ type: 'json', defaultRaw: `'[]'::jsonb` })
	record!: PuzzleEvent[];

	@Property({ type: 'json', defaultRaw: `'[]'::jsonb` })
	freePlayRuns!: FreePlayRun[];
}
