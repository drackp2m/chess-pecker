import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { PuzzleShareResult } from '@chesspecker/api-definitions';

import { StaticChessBoardComponent } from '@app/component/static-chess-board/static-chess-board.component';
import {
	CHALLENGE_DIRECTION_LABEL,
	CHALLENGE_VERDICT_LABEL,
	toChallengeDirection,
} from '@app/definition/challenge.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { ShareRow } from '@app/repository/definition/share-schema.interface';
import { PuzzleRemoteRepository } from '@app/repository/puzzle-remote.repository';
import { PageLoadStore } from '@app/store/page-load.store';
import { ReceivedShareStore } from '@app/store/received-share.store';
import { SessionStore } from '@app/store/session.store';
import { ShareStore } from '@app/store/share.store';
import { answeredCount, participantOf, verdictOf } from '@app/util/challenge-standing';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

@Component({
	templateUrl: './challenge-category.page.html',
	styleUrl: './challenge-category.page.scss',
	imports: [StaticChessBoardComponent, RouterLinkDirective, I18nPipe],
	providers: [provideI18nScope('puzzle')],
})
export class ChallengeCategoryPage implements OnInit {
	protected readonly I18n = I18n;

	private readonly route = inject(ActivatedRoute);
	private readonly shareStore = inject(ShareStore);
	private readonly receivedStore = inject(ReceivedShareStore);
	private readonly session = inject(SessionStore);
	private readonly puzzleRepository = inject(PuzzleRemoteRepository);
	private readonly pageLoad = inject(PageLoadStore);

	readonly direction = toChallengeDirection(this.route.snapshot.paramMap.get('direction'));
	readonly directionLabel = CHALLENGE_DIRECTION_LABEL[this.direction];
	readonly isLoading = signal(true);
	readonly loadError = signal(false);
	readonly puzzles = signal<ReadonlyMap<string, Puzzle>>(new Map());

	private readonly userUuid = computed(() => this.session.user()?.uuid ?? null);

	readonly shares = computed<readonly ShareRow[]>(() => {
		if ('sent' === this.direction) {
			return this.shareStore.sent();
		}

		const pending = this.receivedStore.pending();

		return [...pending, ...this.receivedStore.sorted().filter((row) => !pending.includes(row))];
	});

	ngOnInit(): void {
		void this.pageLoad.track(this.load());
	}

	link(share: ShareRow): string {
		if ('received' === this.direction && null === this.myResult(share)) {
			return `/profile/challenges/received/solve/${share.uuid}`;
		}

		return `/profile/challenges/${this.direction}/${share.uuid}`;
	}

	recipientNames(share: ShareRow): string {
		return share.recipients.map((participant) => participant.user.username).join(', ');
	}

	answered(share: ShareRow): string {
		return answeredCount(share).toString();
	}

	isComplete(share: ShareRow): boolean {
		return answeredCount(share) === share.recipients.length;
	}

	myResult(share: ShareRow): PuzzleShareResult | null {
		return participantOf(share, this.userUuid())?.result ?? null;
	}

	verdictLabel(result: PuzzleShareResult): string {
		return CHALLENGE_VERDICT_LABEL[verdictOf(result)];
	}

	private async load(): Promise<void> {
		try {
			await this.loadShares();
			this.puzzles.set(await this.loadPuzzles(this.shares()));
		} catch {
			this.loadError.set(true);
		} finally {
			this.isLoading.set(false);
		}
	}

	private async loadShares(): Promise<void> {
		if ('sent' === this.direction) {
			await this.shareStore.ready();

			return;
		}

		await this.receivedStore.reload();
	}

	private async loadPuzzles(shares: readonly ShareRow[]): Promise<ReadonlyMap<string, Puzzle>> {
		const ids = [...new Set(shares.map((share) => share.lichessId))];
		const settled = await Promise.allSettled(ids.map((id) => this.puzzleRepository.getOne(id)));
		const puzzles = new Map<string, Puzzle>();

		for (const outcome of settled) {
			if ('fulfilled' === outcome.status) {
				const { uuid: _uuid, ...puzzle } = outcome.value;

				puzzles.set(puzzle.lichessId, PuzzleMapper.toPuzzle(puzzle));
			}
		}

		return puzzles;
	}
}
