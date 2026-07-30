import { Component, computed, inject } from '@angular/core';

import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';

interface HistoryTurn {
	readonly number: number;
	readonly white: string | undefined;
	readonly black: string | undefined;
}

/** The scoresheet: played moves paired up by turn, written in algebraic notation. */
@Component({
	selector: 'app-move-history',
	templateUrl: './move-history.component.html',
	styleUrl: './move-history.component.scss',
})
export class MoveHistoryComponent {
	readonly store = inject(BOARD_PRESENTER);

	readonly turns = computed<HistoryTurn[]>(() => {
		const grouped = new Map<number, HistoryTurn>();

		for (const record of this.store.history()) {
			const turn = grouped.get(record.fullmoveNumber) ?? {
				number: record.fullmoveNumber,
				white: undefined,
				black: undefined,
			};

			grouped.set(record.fullmoveNumber, {
				...turn,
				white: 'white' === record.color ? record.san : turn.white,
				black: 'black' === record.color ? record.san : turn.black,
			});
		}

		return [...grouped.values()];
	});
}
