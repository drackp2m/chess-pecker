import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { PuzzleShareResult } from '@chesspecker/api-definitions';

import { AvatarComponent } from '@app/component/avatar/avatar.component';
import { StaticChessBoardComponent } from '@app/component/static-chess-board/static-chess-board.component';
import {
	CHALLENGE_VERDICT_LABEL,
	ChallengeVerdict,
	toChallengeDirection,
} from '@app/definition/challenge.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { DurationPipe } from '@app/pipe/duration.pipe';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { ShareRow } from '@app/repository/definition/share-schema.interface';
import { PuzzleRemoteRepository } from '@app/repository/puzzle-remote.repository';
import { PuzzleShareRepository } from '@app/repository/puzzle-share.repository';
import { LanguageService } from '@app/service/language.service';
import { PageLoadStore } from '@app/store/page-load.store';
import { ReceivedShareStore } from '@app/store/received-share.store';
import { SessionStore } from '@app/store/session.store';
import { ShareStore } from '@app/store/share.store';
import { toShareRow } from '@app/use-case/share-mirror.use-case';
import {
	ChallengeStanding,
	answeredCount,
	hasAnswered,
	rankStandings,
	verdictOf,
} from '@app/util/challenge-standing';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

@Component({
	templateUrl: './challenge-result.page.html',
	styleUrl: './challenge-result.page.scss',
	imports: [
		AvatarComponent,
		StaticChessBoardComponent,
		ButtonDirective,
		RouterLinkDirective,
		DurationPipe,
		I18nPipe,
	],
	providers: [provideI18nScope('puzzle')],
})
export class ChallengeResultPage implements OnInit {
	protected readonly I18n = I18n;

	private readonly route = inject(ActivatedRoute);
	private readonly shareStore = inject(ShareStore);
	private readonly receivedStore = inject(ReceivedShareStore);
	private readonly session = inject(SessionStore);
	private readonly repository = inject(PuzzleShareRepository);
	private readonly puzzleRepository = inject(PuzzleRemoteRepository);
	private readonly language = inject(LanguageService);
	private readonly pageLoad = inject(PageLoadStore);
	private readonly uuid = this.route.snapshot.paramMap.get('uuid') ?? '';

	readonly direction = toChallengeDirection(this.route.snapshot.paramMap.get('direction'));
	readonly share = signal<ShareRow | undefined>(undefined);
	readonly puzzle = signal<Puzzle | undefined>(undefined);
	readonly isLoading = signal(true);
	readonly loadError = signal(false);

	private readonly userUuid = computed(() => this.session.user()?.uuid ?? null);
	private readonly formatter = computed(
		() => new Intl.DateTimeFormat(this.language.selectedLanguage(), { dateStyle: 'medium' }),
	);

	readonly standings = computed(() => {
		const share = this.share();

		return undefined === share ? [] : rankStandings(share);
	});

	readonly answered = computed(() => {
		const share = this.share();

		return undefined === share ? 0 : answeredCount(share);
	});

	readonly canSolve = computed(() => {
		const share = this.share();

		return (
			'received' === this.direction && undefined !== share && !hasAnswered(share, this.userUuid())
		);
	});

	readonly recipientNames = computed(
		() =>
			this.share()
				?.recipients.map((participant) => participant.user.username)
				.join(', ') ?? '',
	);

	readonly solveLink = `/profile/challenges/received/solve/${this.uuid}`;

	ngOnInit(): void {
		void this.pageLoad.track(this.load());
	}

	isMine(standing: ChallengeStanding): boolean {
		return standing.participant.user.uuid === this.userUuid();
	}

	verdict(result: PuzzleShareResult): ChallengeVerdict {
		return verdictOf(result);
	}

	verdictLabel(result: PuzzleShareResult): string {
		return CHALLENGE_VERDICT_LABEL[verdictOf(result)];
	}

	formatDate(date: Date | string): string {
		return this.formatter().format(new Date(date));
	}

	private async load(): Promise<void> {
		const local = await this.readLocal();

		if (undefined !== local) {
			this.share.set(local);
		}

		try {
			await this.refresh();
		} catch (error: unknown) {
			console.error('Could not refresh the challenge', error);
			this.loadError.set(undefined === local);
		}

		await this.loadPuzzle();
		this.isLoading.set(false);
	}

	private async readLocal(): Promise<ShareRow | undefined> {
		if ('sent' === this.direction) {
			await this.shareStore.ready();

			return this.shareStore.find(this.uuid);
		}

		return this.receivedStore.find(this.uuid);
	}

	private async refresh(): Promise<void> {
		const fresh = await this.repository.getOne(this.uuid);
		const row = toShareRow(fresh);

		if ('sent' === this.direction) {
			await this.shareStore.record(fresh);
		} else {
			this.receivedStore.upsert(row);
		}

		this.share.set(row);
	}

	private async loadPuzzle(): Promise<void> {
		const share = this.share();

		if (undefined === share) {
			return;
		}

		try {
			const { uuid: _uuid, ...puzzle } = await this.puzzleRepository.getOne(share.lichessId);

			this.puzzle.set(PuzzleMapper.toPuzzle(puzzle));
		} catch (error: unknown) {
			console.error('Could not load the challenge exercise', error);
		}
	}
}
