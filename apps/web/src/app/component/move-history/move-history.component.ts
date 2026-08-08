import {
	Component,
	ElementRef,
	afterRenderEffect,
	computed,
	inject,
	input,
	viewChild,
} from '@angular/core';

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

	readonly title = input<string>();

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

	private readonly line = viewChild<ElementRef<HTMLElement>>('line');

	constructor() {
		// The line runs off the right edge, so whatever was just written has to be pulled
		// back into view — after the render that put it there, never before.
		afterRenderEffect(() => {
			this.turns();

			const element = this.line()?.nativeElement;

			if ('function' === typeof element?.scrollTo) {
				element.scrollTo({ left: element.scrollWidth });
			}
		});
	}
}
