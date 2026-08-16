import { Injectable, computed, effect, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import {
	SolvedAttempt,
	TrainingHistoryScope,
	TrainingHistoryUseCase,
} from '@app/use-case/training-history.use-case';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

interface TrainingReviewProps {
	entries: readonly SolvedAttempt[];
	index: number | null;
}

const initialState: TrainingReviewProps = {
	entries: [],
	index: null,
};

@Injectable()
export class TrainingReviewStore extends signalStore(
	{ protectedState: false },
	withState(initialState),
) {
	readonly available = computed(() => {
		const solving = this.run.current()?.puzzle;

		return this.entries().filter(
			(entry) => undefined === solving || entry.row.puzzleUuid !== PuzzleMapper.toKey(solving),
		);
	});

	readonly reviewed = computed<SolvedAttempt | null>(() => {
		const at = this.index();

		return null === at ? null : (this.available()[at] ?? null);
	});

	readonly isReviewing = computed(() => null !== this.reviewed());

	readonly hasPrevious = computed(() => {
		const at = this.index();

		return null === at ? 0 < this.available().length : 0 < at;
	});

	readonly hasNext = computed(() => {
		const at = this.index();

		return null !== at && at < this.available().length - 1;
	});

	private readonly run = inject(TrainingRunStore);
	private readonly history = inject(TrainingHistoryUseCase);

	constructor() {
		super();

		effect(() => {
			const scope = this.scope();
			const solving = this.run.current()?.puzzle;

			void this.reload(undefined === solving ? undefined : scope);
		});
	}

	previous(): SolvedAttempt | null {
		const at = this.index();
		const step = null === at ? this.available().length - 1 : at - 1;

		if (0 > step) {
			return null;
		}

		patchState(this, { index: step });

		return this.reviewed();
	}

	forward(): SolvedAttempt | null {
		const at = this.index();

		if (null === at || at + 1 >= this.available().length) {
			this.leave();

			return null;
		}

		patchState(this, { index: at + 1 });

		return this.reviewed();
	}

	leave(): void {
		patchState(this, { index: null });
	}

	private scope(): TrainingHistoryScope | undefined {
		const trainingUuid = this.run.trainingUuid();
		const kind = this.run.mode();

		if (null === trainingUuid || null === kind) {
			return undefined;
		}

		const roundUuid = this.run.round()?.uuid;

		return { trainingUuid, kind, ...(undefined === roundUuid ? {} : { roundUuid }) };
	}

	private async reload(scope: TrainingHistoryScope | undefined): Promise<void> {
		if (undefined === scope) {
			patchState(this, initialState);

			return;
		}

		patchState(this, { index: null });
		patchState(this, { entries: await this.history.list(scope).catch(() => []) });
	}
}
