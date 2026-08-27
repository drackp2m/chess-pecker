import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PuzzleSolverComponent } from '@app/component/puzzle-solver/puzzle-solver.component';
import { DEFAULT_MOVE_ANIMATION } from '@app/definition/board-animation.type';
import { MOVE_INPUT_METHODS_ALL } from '@app/definition/board-input.type';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { DEFAULT_MOVE_SPEED } from '@app/definition/move-speed.type';
import { DEFAULT_MOVE_LIFT } from '@app/definition/piece-lift.constant';
import { Puzzle } from '@app/definition/puzzle.type';
import { I18n } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { SoundService } from '@app/service/sound.service';
import { provideTestingBookmarks } from '@app/testing/bookmark.harness';
import { provideTestingI18n } from '@app/testing/i18n.harness';
import {
	HINT_TOTAL,
	NAV_LABELS,
	NAV_ORDER,
	NavControl,
	REPLAY_TOTAL,
	navControls,
} from '@app/testing/puzzle-store.harness';
import { PuzzleImportUseCase } from '@app/use-case/puzzle-import.use-case';

const PUZZLE: Puzzle = {
	id: 'JOGv3',
	fen: '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27',
	moves: ['f1f8', 'b2b1', 'b3d1', 'b1d1', 'f8f1', 'd1f1'],
	rating: 536,
	themes: ['backRankMate', 'mateIn3'],
	selectedFor: '500-599 / backRankMate',
};

/**
 * Stands in for whichever page hosts the view: it owns the exercise and the stores, and
 * answers the two arrows the view pins to the ends of the control row.
 */
@Component({
	selector: 'app-solver-host',
	imports: [PuzzleSolverComponent],
	template: `<app-puzzle-solver
		[previousLabel]="I18n.puzzle.PREVIOUS_EXERCISE"
		[nextLabel]="I18n.puzzle.NEXT_EXERCISE"
		(previous)="stepped.push('previous')"
		(next)="stepped.push('next')"
	/>`,
	providers: [
		PuzzleLibraryStore,
		PuzzleStore,
		{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
	],
})
class SolverHostComponent {
	protected readonly I18n = I18n;

	readonly store = inject(PuzzleStore);

	readonly stepped: string[] = [];
}

function createHost() {
	TestBed.configureTestingModule({
		providers: [
			provideTestingI18n(),
			provideTestingBookmarks(),
			{
				provide: BoardPreferenceService,
				useValue: {
					moveSpeed: signal(DEFAULT_MOVE_SPEED),
					moveAnimation: signal(DEFAULT_MOVE_ANIMATION),
					moveInputMethods: signal(MOVE_INPUT_METHODS_ALL),
					moveLift: signal(DEFAULT_MOVE_LIFT),
				},
			},
			{ provide: SoundService, useValue: { play: (): void => undefined } },
			{
				provide: PuzzleImportUseCase,
				useValue: {
					import: (name: string, puzzles: readonly Puzzle[]) =>
						Promise.resolve({ uuid: name, name, puzzles }),
					findLast: () => Promise.resolve(undefined),
				} satisfies Partial<PuzzleImportUseCase>,
			},
		],
	});

	const fixture = TestBed.createComponent(SolverHostComponent);

	fixture.detectChanges();

	const element = fixture.nativeElement as HTMLElement;

	return {
		store: fixture.componentInstance.store,
		stepped: fixture.componentInstance.stepped,

		element,

		open(): void {
			fixture.componentInstance.store.setPuzzles([PUZZLE]);
			vi.advanceTimersByTime(1500);
			fixture.detectChanges();
		},

		/** Clicks a control by its label, which on an icon button is all the player has. */
		click(label: string): void {
			fixture.detectChanges();

			element.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click();

			fixture.detectChanges();
		},

		/** A control as it stands in the row, to read the state the view paints on it. */
		control(label: string): HTMLButtonElement | null {
			fixture.detectChanges();

			return element.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
		},

		themes(): string[] {
			return [...element.querySelectorAll('.theme')].map((item) => item.textContent);
		},

		advance(duration: number): void {
			vi.advanceTimersByTime(duration);
			fixture.detectChanges();
		},

		/** The line controls the player can actually press, read off the rendered row. */
		enabledNav(): NavControl[] {
			fixture.detectChanges();

			return NAV_ORDER.filter((control) => {
				const selector = `[aria-label="${NAV_LABELS[control]}"]`;

				return false === element.querySelector<HTMLButtonElement>(selector)?.disabled;
			});
		},
	};
}

describe('PuzzleSolverComponent', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('draws nothing until the host opens an exercise', () => {
		const host = createHost();

		expect(host.element.querySelector('app-chess-board')).toBeNull();
	});

	it('draws the board, the panel and the scoresheet once there is one', () => {
		const host = createHost();

		host.open();

		expect(host.element.querySelector('app-chess-board')).not.toBeNull();
		expect(host.element.querySelector('app-move-history')).not.toBeNull();
		expect(host.element.querySelector('.panel')).not.toBeNull();
	});

	it('keeps the themes covered until the hint is taken', () => {
		const host = createHost();

		host.open();

		expect(host.themes()).toEqual([]);
		expect(host.element.querySelector('.themes')).toBeNull();

		host.click(I18n.common.BOARD_HINT);

		expect(host.themes()).toEqual([]);
		expect(host.store.hintUsed()).toBe(false);

		host.advance(HINT_TOTAL);
		host.click(I18n.common.BOARD_HINT);

		expect(host.themes()).toEqual(['backRankMate', 'mateIn3']);
		expect(host.store.hintUsed()).toBe(true);
	});

	it('offers the answer only once the exercise has been missed', () => {
		const host = createHost();

		host.open();
		host.click(I18n.common.BOARD_GIVE_UP);

		expect(host.store.closure()).toBe('open');

		// The move to find is Rb1+; Rc2 is legal and is not it.
		host.store.selectSquare('b2');
		host.store.selectSquare('c2');
		host.click(I18n.common.BOARD_GIVE_UP);

		expect(host.store.closure()).toBe('revealed');
	});

	it('marks the flag and puts it out of reach for good once it has been pressed', () => {
		const host = createHost();

		host.open();
		host.store.selectSquare('b2');
		host.store.selectSquare('c2');
		host.click(I18n.common.BOARD_GIVE_UP);
		host.advance(REPLAY_TOTAL * 5);

		// The answer is out and watched to the end: all that is left is walking it.
		const flag = host.control(I18n.common.BOARD_GIVE_UP);

		expect(flag?.disabled).toBe(true);
		expect(flag?.classList.contains('active')).toBe(true);
		expect(host.enabledNav()).toEqual(['restart', 'back']);
	});

	it('hands the arrows on the ends of the row back to the host, under its own labels', () => {
		const host = createHost();

		host.open();
		host.click(I18n.puzzle.PREVIOUS_EXERCISE);
		host.click(I18n.puzzle.NEXT_EXERCISE);

		expect(host.stepped).toEqual(['previous', 'next']);
	});

	/**
	 * The store decides what may be pressed; the row only paints it. Every state is checked
	 * against both, so neither side can drift away from the other.
	 */
	it('gates the line controls on what the store says, and only on that', () => {
		const host = createHost();

		host.open();

		expect(host.enabledNav()).toEqual(['restart', 'back']);
		expect(navControls(host.store)).toEqual(['restart', 'back']);

		host.click(I18n.common.BOARD_STEP_BACKWARD);

		// The opening position: there is nowhere to go back to, and no line to restart.
		expect(host.enabledNav()).toEqual(['forward']);
		expect(navControls(host.store)).toEqual(['forward']);

		host.click(I18n.common.BOARD_STEP_FORWARD);
		host.store.selectSquare('b2');
		host.store.selectSquare('b1');
		host.advance(1500);

		expect(host.store.cursor()).toBe(3);
		expect(host.enabledNav()).toEqual(['restart', 'back']);

		host.click(I18n.common.BOARD_RESTART);

		// Mid-replay nothing is pressable, and the cursor is on the opening position.
		expect(host.enabledNav()).toEqual([]);
		expect(navControls(host.store)).toEqual([]);

		host.advance(1500);

		// And the line the restart left standing is there to be walked back up.
		expect(host.store.cursor()).toBe(1);
		expect(host.enabledNav()).toEqual(['restart', 'back', 'forward']);
		expect(navControls(host.store)).toEqual(['restart', 'back', 'forward']);
	});

	it('drives the shared store from the line controls', () => {
		const host = createHost();

		host.open();

		// The opponent's opening move has been replayed, so the line can be rewound.
		expect(host.store.cursor()).toBe(1);

		host.click(I18n.common.BOARD_STEP_BACKWARD);

		expect(host.store.cursor()).toBe(0);

		host.click(I18n.common.BOARD_FLIP);

		expect(host.store.orientation()).toBe('white');
	});
});
