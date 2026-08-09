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
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';

interface HistoryTurn {
	readonly number: number;
	readonly white: string | undefined;
	readonly black: string | undefined;
}

@Component({
	selector: 'app-move-history',
	templateUrl: './move-history.component.html',
	styleUrl: './move-history.component.scss',
	imports: [I18nPipe],
})
export class MoveHistoryComponent {
	protected readonly I18n = I18n;

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
		afterRenderEffect(() => {
			this.turns();

			const element = this.line()?.nativeElement;

			if ('function' === typeof element?.scrollTo) {
				element.scrollTo({ left: element.scrollWidth });
			}
		});
	}
}
