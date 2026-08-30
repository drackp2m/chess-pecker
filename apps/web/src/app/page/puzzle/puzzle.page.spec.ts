import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOVE_ANIMATION } from '@app/definition/board-animation.type';
import { MOVE_INPUT_METHODS_ALL } from '@app/definition/board-input.type';
import { DEFAULT_MOVE_SPEED } from '@app/definition/move-speed.type';
import { DEFAULT_MOVE_LIFT } from '@app/definition/piece-lift.constant';
import { Puzzle } from '@app/definition/puzzle.type';
import { I18n } from '@app/i18n';
import { PuzzlePage } from '@app/page/puzzle/puzzle.page';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { SoundService } from '@app/service/sound.service';
import { provideTestingBookmarks } from '@app/testing/bookmark.harness';
import { provideTestingI18n } from '@app/testing/i18n.harness';
import { provideTestingShares } from '@app/testing/share.harness';
import { PuzzleImportUseCase } from '@app/use-case/puzzle-import.use-case';

/**
 * Every settings-backed service is stubbed whole, so the page is tested against fixed
 * preferences rather than whatever the setting store would load.
 */
function createPage(data: Record<string, unknown>): PuzzlePage {
	TestBed.configureTestingModule({
		imports: [PuzzlePage],
		providers: [
			provideTestingI18n(),
			provideTestingBookmarks(),
			provideTestingShares(),
			{ provide: ActivatedRoute, useValue: { snapshot: { data } } },
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

	const fixture = TestBed.createComponent(PuzzlePage);

	// The route decides what the page opens with, and that now runs in `ngOnInit`.
	fixture.detectChanges();

	return fixture.componentInstance;
}

/** A file picker `change` event, with a file that reads however the test wants. */
function createFileEvent(name: string, read: () => Promise<string>): Event {
	const file = { name, text: read } as unknown as File;
	const input = { files: [file], value: `C:\\fakepath\\${name}` } as unknown as HTMLInputElement;

	return { target: input } as unknown as Event;
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
		expect(page.headline()).toBe(I18n.common.FIND_MOVE_BLACK);

		// And the first solving move is accepted.
		page.store.selectSquare('b2');
		page.store.selectSquare('b1');

		expect(page.store.history()[1]?.san).toBe('Rb1+');
	});

	it('reports an unreadable file instead of dying on the rejection', async () => {
		const page = createPage({});
		const event = createFileEvent('set.csv', () => Promise.reject(new Error('unreadable')));

		await page.loadFile(event);

		expect(page.store.library.importError()).toEqual({
			key: I18n.puzzle.FILE_UNREADABLE,
			params: { name: 'set.csv' },
		});
		expect(page.store.library.puzzles()).toHaveLength(0);
		// Cleared even on failure, so picking the same file again still fires `change`.
		expect((event.target as HTMLInputElement).value).toBe('');
	});

	it('imports a readable file and clears the picker', async () => {
		const page = createPage({ sample: true });
		const sample = page.store.puzzle();
		const event = createFileEvent('set.csv', () =>
			Promise.resolve(
				`PuzzleId,FEN,Moves,Rating\nZZZZZ,${sample?.fen ?? ''},${sample?.moves.join(' ') ?? ''},600`,
			),
		);

		await page.loadFile(event);

		expect(page.store.library.importError()).toBeUndefined();
		expect(page.store.puzzle()?.id).toBe('ZZZZZ');
		expect((event.target as HTMLInputElement).value).toBe('');
	});
});
