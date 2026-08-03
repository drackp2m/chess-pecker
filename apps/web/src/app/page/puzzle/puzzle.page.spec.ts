import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOVE_ANIMATION } from '@app/definition/board-animation.type';
import { MOVE_INPUT_METHODS_ALL } from '@app/definition/board-input.type';
import { DEFAULT_MISTAKE_POLICY } from '@app/definition/mistake-policy.type';
import { DEFAULT_MOVE_SPEED } from '@app/definition/move-speed.type';
import { PuzzlePage } from '@app/page/puzzle/puzzle.page';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { MistakePolicyService } from '@app/service/mistake-policy.service';
import { SoundService } from '@app/service/sound.service';

/**
 * Every settings-backed service is stubbed whole, the same way `puzzle.store.spec` does
 * it: the page is tested against fixed preferences rather than against whatever the
 * setting store would end up loading, and nothing below them is instantiated.
 */
function createPage(data: Record<string, unknown>): PuzzlePage {
	TestBed.configureTestingModule({
		imports: [PuzzlePage],
		providers: [
			{ provide: ActivatedRoute, useValue: { snapshot: { data } } },
			{ provide: MistakePolicyService, useValue: { policy: signal(DEFAULT_MISTAKE_POLICY) } },
			{
				provide: BoardPreferenceService,
				useValue: {
					moveSpeed: signal(DEFAULT_MOVE_SPEED),
					moveAnimation: signal(DEFAULT_MOVE_ANIMATION),
					moveInputMethods: signal(MOVE_INPUT_METHODS_ALL),
				},
			},
			{ provide: SoundService, useValue: { playMove: (): void => undefined } },
		],
	});

	return TestBed.createComponent(PuzzlePage).componentInstance;
}

describe('PuzzlePage', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('waits for an import on the plain route', () => {
		const page = createPage({});

		expect(page.store.library.puzzles()).toHaveLength(0);
		expect(page.store.outcome()).toBe('idle');
	});

	it('opens the bundled example ready to play on the sample route', () => {
		const page = createPage({ sample: true });

		vi.advanceTimersByTime(1500);

		expect(page.store.library.puzzles()).toHaveLength(1);
		expect(page.store.puzzle()?.id).toBe('JOGv3');

		// The opponent's scripted move has been replayed, so it is the player's turn.
		expect(page.store.history()[0]?.san).toBe('Rxf8');
		expect(page.store.playerColor()).toBe('black');
		expect(page.store.isPlayerTurn()).toBe(true);
		expect(page.headline()).toBe('Find the move for black');

		// And the first solving move is accepted.
		page.store.selectSquare('b2');
		page.store.selectSquare('b1');

		expect(page.store.history()[1]?.san).toBe('Rb1+');
	});
});
