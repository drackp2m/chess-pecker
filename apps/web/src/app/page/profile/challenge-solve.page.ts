import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { PuzzleShareResultRequest } from '@chesspecker/api-definitions';

import { PuzzleDifficultyComponent } from '@app/component/puzzle-difficulty/puzzle-difficulty.component';
import { PuzzleSolverComponent } from '@app/component/puzzle-solver/puzzle-solver.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { Puzzle } from '@app/definition/puzzle.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, i18nRef, provideI18nScope } from '@app/i18n';
import { puzzleHeadline } from '@app/page/puzzle/store/puzzle/headline';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { puzzleShareResult } from '@app/page/puzzle/store/puzzle/share-result';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { ShareRow } from '@app/repository/definition/share-schema.interface';
import { PuzzleRemoteRepository } from '@app/repository/puzzle-remote.repository';
import { PuzzleShareRepository } from '@app/repository/puzzle-share.repository';
import { NotificationService } from '@app/service/notification.service';
import { PageLoadStore } from '@app/store/page-load.store';
import { ReceivedShareStore } from '@app/store/received-share.store';
import { SessionStore } from '@app/store/session.store';
import { toShareRow } from '@app/use-case/share-mirror.use-case';
import { hasAnswered } from '@app/util/challenge-standing';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

@Component({
	templateUrl: './challenge-solve.page.html',
	styleUrl: './challenge-solve.page.scss',
	imports: [
		PuzzleDifficultyComponent,
		PuzzleSolverComponent,
		ButtonDirective,
		RouterLinkDirective,
		I18nPipe,
	],
	providers: [
		provideI18nScope('puzzle'),
		PuzzleLibraryStore,
		PuzzleStore,
		{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
	],
})
export class ChallengeSolvePage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(PuzzleStore);
	readonly isLoading = signal(true);
	readonly loadError = signal(false);
	readonly isSubmitting = signal(false);
	readonly failedLichessId = signal<string | null>(null);
	readonly headline = computed(() => puzzleHeadline(this.store));
	readonly counter = computed(() => {
		const total = this.store.library.puzzles().length;

		return 0 === total
			? ''
			: `${(this.store.library.index() + 1).toString()} / ${total.toString()}`;
	});

	private readonly route = inject(ActivatedRoute);
	private readonly receivedStore = inject(ReceivedShareStore);
	private readonly session = inject(SessionStore);
	private readonly puzzles = inject(PuzzleRemoteRepository);
	private readonly repository = inject(PuzzleShareRepository);
	private readonly notificationService = inject(NotificationService);
	private readonly pageLoad = inject(PageLoadStore);
	private readonly queue = signal<readonly ShareRow[]>([]);
	private readonly submitted = new Set<string>();

	readonly current = computed(() => {
		const lichessId = this.store.puzzle()?.id;
		const uuids = new Set(
			this.queue()
				.filter((share) => share.lichessId === lichessId)
				.map((share) => share.uuid),
		);

		return this.receivedStore.shares().filter((share) => uuids.has(share.uuid));
	});

	readonly senders = computed(() =>
		this.current()
			.map((share) => share.sender.user.username)
			.join(', '),
	);

	readonly isAnswered = computed(() => {
		const userUuid = this.session.user()?.uuid ?? null;
		const shares = this.current();

		return 0 < shares.length && shares.every((share) => hasAnswered(share, userUuid));
	});

	constructor() {
		effect(() => {
			const puzzle = this.store.puzzle();
			const result = puzzleShareResult(this.store);

			if (undefined !== puzzle && undefined !== result) {
				untracked(() => void this.answer(puzzle.id, result));
			}
		});
	}

	ngOnInit(): void {
		void this.pageLoad.track(this.load());
	}

	resultsLink(share: ShareRow): string {
		return `/profile/challenges/received/${share.uuid}`;
	}

	retry(): void {
		const lichessId = this.failedLichessId();
		const result = puzzleShareResult(this.store);

		if (null !== lichessId && undefined !== result) {
			this.submitted.delete(lichessId);
			void this.answer(lichessId, result);
		}
	}

	private async load(): Promise<void> {
		try {
			await this.receivedStore.ensureLoaded();

			const queue = this.buildQueue();
			const ids = [...new Set(queue.map((share) => share.lichessId))];
			const loaded = await Promise.all(ids.map((id) => this.puzzles.getOne(id)));
			const exercises: Puzzle[] = loaded.map(({ uuid: _uuid, ...puzzle }) =>
				PuzzleMapper.toPuzzle(puzzle),
			);

			this.queue.set(queue);
			this.store.setPuzzles(exercises);
			this.selectRequested(queue, exercises);
		} catch {
			this.loadError.set(true);
		} finally {
			this.isLoading.set(false);
		}
	}

	private buildQueue(): readonly ShareRow[] {
		const pending = this.receivedStore.pending();
		const requested = this.receivedStore.find(this.route.snapshot.paramMap.get('uuid') ?? '');

		if (undefined === requested || pending.includes(requested)) {
			return pending;
		}

		return [requested, ...pending];
	}

	private selectRequested(queue: readonly ShareRow[], exercises: readonly Puzzle[]): void {
		const uuid = this.route.snapshot.paramMap.get('uuid');
		const lichessId = queue.find((share) => share.uuid === uuid)?.lichessId;
		const index = exercises.findIndex((puzzle) => puzzle.id === lichessId);

		if (0 <= index) {
			this.store.selectPuzzle(index);
		}
	}

	private async answer(lichessId: string, result: PuzzleShareResultRequest): Promise<void> {
		const userUuid = this.session.user()?.uuid ?? null;
		const targets = this.queue().filter(
			(share) => share.lichessId === lichessId && !hasAnswered(share, userUuid),
		);

		if (this.submitted.has(lichessId) || 0 === targets.length) {
			return;
		}

		this.submitted.add(lichessId);
		this.isSubmitting.set(true);
		this.failedLichessId.set(null);

		try {
			await this.submit(targets, result);
		} catch (error: unknown) {
			console.error('Could not answer the challenge', error);
			this.failedLichessId.set(lichessId);
			this.notificationService.notify(i18nRef(I18n.common.CHALLENGE_ANSWER_ERROR));
		} finally {
			this.isSubmitting.set(false);
		}
	}

	private async submit(
		targets: readonly ShareRow[],
		result: PuzzleShareResultRequest,
	): Promise<void> {
		const saved = await Promise.all(
			targets.map((share) => this.repository.submitAttempt(share.uuid, result)),
		);

		for (const share of saved) {
			this.receivedStore.upsert(toShareRow(share));
		}

		this.notificationService.notify(
			i18nRef(I18n.common.CHALLENGE_ANSWER_SENT, {
				username: targets.map((share) => share.sender.user.username).join(', '),
			}),
		);
	}
}
