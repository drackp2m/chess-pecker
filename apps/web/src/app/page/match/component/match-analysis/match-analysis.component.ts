import { Component, DestroyRef, computed, effect, inject, input } from '@angular/core';

import { ChessPieceComponent } from '@app/component/chess-piece/chess-piece.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { PieceColor } from '@app/definition/chess.type';
import { I18n } from '@app/i18n';
import {
	CapturedGroup,
	capturedBy,
	materialOf,
} from '@app/page/match/component/match-analysis/captured-pieces';
import { readGauge } from '@app/page/match/component/match-analysis/evaluation-gauge';
import { PositionAnalysisService } from '@app/page/match/service/position-analysis.service';
import { MatchStore } from '@app/page/match/store/match.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { AnalysisPreferenceService } from '@app/service/analysis-preference.service';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { PIECE_LABEL_KEY } from '@app/util/chess/piece-label';

const FULL_SHARE = 100;

interface CapturedSide {
	readonly color: PieceColor;
	readonly rival: PieceColor;
	readonly captured: readonly CapturedGroup[];
	readonly advantage: number | undefined;
}

interface GaugeLayer {
	readonly color: PieceColor;
	readonly clip: string;
}

interface GaugeBar {
	readonly split: number;
	readonly label: string | undefined;
	readonly isTrailingAhead: boolean;
	readonly layers: readonly GaugeLayer[];
}

@Component({
	selector: 'app-match-analysis',
	templateUrl: './match-analysis.component.html',
	styleUrl: './match-analysis.component.scss',
	imports: [ChessPieceComponent, MoveHistoryComponent, I18nPipe],
})
export class MatchAnalysisComponent {
	protected readonly I18n = I18n;

	protected readonly PIECE_LABEL_KEY = PIECE_LABEL_KEY;

	readonly isGaugeShown = input(false);

	readonly store = inject(MatchStore);

	readonly analysis = inject(PositionAnalysisService);

	readonly preference = inject(AnalysisPreferenceService);

	readonly status = computed(() => {
		const line = this.store.line();

		return ChessMoveGenerator.status(this.store.position(), line.positions.slice(0, line.cursor));
	});

	readonly sides = computed<CapturedSide[]>(() => {
		const leading = this.store.orientation();

		const colors = [leading, opposite(leading)];
		const captured = colors.map((color) => capturedBy(this.store.history(), color));
		const material = captured.map((groups) => materialOf(groups));

		return colors.map((color, index) => {
			const advantage = (material[index] ?? 0) - (material[1 - index] ?? 0);

			return {
				color,
				rival: opposite(color),
				captured: captured[index] ?? [],
				advantage: 0 < advantage ? advantage : undefined,
			};
		});
	});

	readonly bar = computed<GaugeBar>(() => {
		const gauge = readGauge(this.status(), this.store.position(), this.analysis.evaluation());
		const leading = this.store.orientation();
		const split = 'white' === leading ? gauge.whiteShare : FULL_SHARE - gauge.whiteShare;

		return {
			split,
			label: gauge.label,
			isTrailingAhead: leading !== gauge.leader,
			layers: [
				{ color: opposite(leading), clip: 'none' },
				{ color: leading, clip: `inset(0 ${String(FULL_SHARE - split)}% 0 0)` },
			],
		};
	});

	constructor() {
		effect(() => {
			if (this.isGaugeShown() && 'playing' === this.status()) {
				const line = this.store.line();
				const position = this.store.position();
				const game = {
					start: line.positions[0] ?? position,
					moves: line.moves.slice(0, line.cursor),
				};

				this.analysis.analyse(game, position, this.preference.depth());
			} else {
				this.analysis.halt();
			}
		});

		inject(DestroyRef).onDestroy(() => {
			this.analysis.halt();
		});
	}
}

function opposite(color: PieceColor): PieceColor {
	return 'white' === color ? 'black' : 'white';
}
