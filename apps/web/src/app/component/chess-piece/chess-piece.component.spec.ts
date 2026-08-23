import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChessPieceComponent, PieceSlide } from '@app/component/chess-piece/chess-piece.component';
import { PieceColor, PieceType } from '@app/definition/chess.type';
import { MoveSpeed, SLIDE_DURATION, scaleForSpeed } from '@app/definition/move-speed.type';
import { BoardPreferenceService } from '@app/service/board-preference.service';

/** A rook coming in from seven files away, as the board strip would describe it. */
function slideFrom(key: number): PieceSlide {
	return { x: -700, y: 0, key };
}

/**
 * The test DOM has no Web Animations API, which is exactly what the component
 * feature-detects, so the spy stands in for it and records what it was asked to run.
 */
function createPiece(speed: MoveSpeed = 'normal') {
	TestBed.configureTestingModule({
		providers: [{ provide: BoardPreferenceService, useValue: { moveSpeed: signal(speed) } }],
	});

	const fixture = TestBed.createComponent(ChessPieceComponent);
	const cancel = vi.fn();
	const animate = vi.fn();

	animate.mockReturnValue({ cancel });

	(fixture.nativeElement as { animate: unknown }).animate = animate;
	fixture.componentRef.setInput('type', 'rook');
	fixture.componentRef.setInput('color', 'black');
	fixture.detectChanges();

	return {
		animate,
		cancel,

		/** A fresh object every time, the way a recomputed board square hands one over. */
		show(slide: PieceSlide | undefined): void {
			fixture.componentRef.setInput('slide', undefined === slide ? undefined : { ...slide });
			fixture.detectChanges();
		},

		/** The square drawing somebody else, which is all a jumped board leaves behind. */
		redraw(type: PieceType, color: PieceColor): void {
			fixture.componentRef.setInput('type', type);
			fixture.componentRef.setInput('color', color);
			fixture.detectChanges();
		},
	};
}

describe('ChessPieceComponent', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('stands still until it is handed a slide', () => {
		const piece = createPiece();

		expect(piece.animate).not.toHaveBeenCalled();
	});

	it('slides in from the square the move came from', () => {
		const piece = createPiece();

		piece.show(slideFrom(1));

		expect(piece.animate).toHaveBeenCalledTimes(1);
		expect(piece.animate.mock.calls[0]?.[0]).toEqual([
			{ transform: 'translate(-700%, 0%)' },
			{ transform: 'none' },
		]);
	});

	it('runs a slide once, however often the board is redrawn around it', () => {
		const piece = createPiece();

		piece.show(slideFrom(1));
		piece.show(slideFrom(1));
		piece.show(slideFrom(1));

		expect(piece.animate).toHaveBeenCalledTimes(1);
	});

	/**
	 * The rule the whole animation policy rests on: a piece knows a slide only by its
	 * key, so a key that comes round a second time is one it will refuse to run. This
	 * is why the tick behind it counts board events for the session and is never reset
	 * — a restart or a rewind that handed out tick 1 again would leave a piece that
	 * had already run tick 1 sitting on its square.
	 */
	it('runs the same journey again under a key it has not seen', () => {
		const piece = createPiece();

		piece.show(slideFrom(1));
		piece.show(undefined);
		piece.show(slideFrom(1));

		expect(piece.animate).toHaveBeenCalledTimes(1);

		piece.show(slideFrom(2));

		expect(piece.animate).toHaveBeenCalledTimes(2);
	});

	/**
	 * The square keeps its element from one position to the next, so a journey left
	 * running over a board that has jumped away — a restart, a rewind — would be drawn
	 * on whatever piece stands there now, and the mover would be seen turning into the
	 * piece it was taking.
	 */
	it('calls the slide off when the board jumps out from under it', () => {
		const piece = createPiece();

		piece.show(slideFrom(1));

		expect(piece.cancel).not.toHaveBeenCalled();

		piece.show(undefined);

		expect(piece.cancel).toHaveBeenCalledTimes(1);
	});

	it('calls it off when the square it stands on changes piece mid-flight', () => {
		const piece = createPiece();

		piece.show(slideFrom(1));
		piece.redraw('queen', 'white');

		expect(piece.cancel).toHaveBeenCalledTimes(1);
	});

	it('leaves a slide alone while the piece running it is still the one drawn', () => {
		const piece = createPiece();

		piece.show(slideFrom(1));
		piece.show(slideFrom(1));
		piece.redraw('rook', 'black');

		expect(piece.cancel).not.toHaveBeenCalled();
	});

	it('takes as long over it as the chosen move speed says', () => {
		for (const speed of ['slow', 'normal', 'fast'] as const) {
			const piece = createPiece(speed);

			piece.show(slideFrom(1));

			expect(piece.animate.mock.calls[0]?.[1]).toMatchObject({
				duration: scaleForSpeed(SLIDE_DURATION, speed),
			});

			TestBed.resetTestingModule();
		}
	});
});
