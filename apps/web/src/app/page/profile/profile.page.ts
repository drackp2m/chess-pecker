import { Component, OnInit, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FriendUser, PuzzleBookmarkType } from '@chesspecker/api-definitions';

import {
	CHALLENGE_DIRECTIONS,
	CHALLENGE_DIRECTION_LABEL,
	ChallengeDirection,
} from '@app/definition/challenge.type';
import { PUZZLE_BOOKMARK_LABEL, PUZZLE_BOOKMARK_TYPES } from '@app/definition/puzzle-bookmark.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BookmarkStore } from '@app/store/bookmark.store';
import { PageLoadStore } from '@app/store/page-load.store';
import { ProfileStore } from '@app/store/profile.store';
import { ReceivedShareStore } from '@app/store/received-share.store';
import { SessionStore } from '@app/store/session.store';
import { ShareStore } from '@app/store/share.store';
import { LogOutUseCase } from '@app/use-case/log-out.use-case';

@Component({
	templateUrl: './profile.page.html',
	styleUrl: './profile.page.scss',
	imports: [RouterLinkDirective, ReactiveFormsModule, InputDirective, ButtonDirective, I18nPipe],
	providers: [provideI18nScope('profile')],
})
export class ProfilePage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(ProfileStore);
	readonly session = inject(SessionStore);
	readonly bookmarks = inject(BookmarkStore);
	readonly bookmarkLabels = PUZZLE_BOOKMARK_LABEL;
	readonly challengeLabels = CHALLENGE_DIRECTION_LABEL;

	private readonly shares = inject(ShareStore);
	private readonly receivedShares = inject(ReceivedShareStore);

	readonly bookmarkTypes = computed(() =>
		PUZZLE_BOOKMARK_TYPES.filter((type) => 0 < this.bookmarkCount(type)),
	);

	readonly hasNoBookmarks = computed(
		() => !this.bookmarks.isLoading() && 0 === this.bookmarkTypes().length,
	);

	readonly challengeDirections = computed(() =>
		CHALLENGE_DIRECTIONS.filter((direction) => 0 < this.challengeCount(direction)),
	);

	readonly hasNoChallenges = computed(
		() =>
			!this.shares.isLoading() &&
			this.receivedShares.isLoaded() &&
			0 === this.challengeDirections().length,
	);

	private readonly logOutUseCase = inject(LogOutUseCase);
	private readonly pageLoad = inject(PageLoadStore);

	readonly form = new FormGroup({
		username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
	});

	ngOnInit(): void {
		this.store.clearFeedback();
		this.store.clearSearch();
		void this.pageLoad.track(this.store.load());
		void this.pageLoad.track(this.bookmarks.ready());
		void this.pageLoad.track(this.shares.ready());
		void this.receivedShares.refresh();
	}

	logOut(): void {
		void this.logOutUseCase.execute();
	}

	retryConnection(): void {
		void this.session.retry();
	}

	submit(): void {
		void this.search();
	}

	sendRequest(username: string): void {
		void this.sendAndReset(username);
	}

	accept(uuid: string): void {
		void this.store.accept(uuid);
	}

	decline(uuid: string): void {
		void this.store.decline(uuid);
	}

	remove(uuid: string): void {
		void this.store.remove(uuid);
	}

	unfriend(friend: FriendUser): void {
		void this.store.unfriend(friend);
	}

	block(username: string): void {
		void this.store.block(username);
	}

	unblock(uuid: string): void {
		void this.store.unblock(uuid);
	}

	bookmarkCount(type: PuzzleBookmarkType): number {
		return this.bookmarks.bookmarkEntities().filter((bookmark) => bookmark.type === type).length;
	}

	bookmarkLink(type: PuzzleBookmarkType): string {
		return `/profile/bookmarks/${type}`;
	}

	challengeCount(direction: ChallengeDirection): number {
		return 'sent' === direction ? this.shares.sent().length : this.receivedShares.shares().length;
	}

	challengeLink(direction: ChallengeDirection): string {
		return `/profile/challenges/${direction}`;
	}

	private async search(): Promise<void> {
		if (this.form.invalid) {
			this.form.markAllAsTouched();

			return;
		}

		await this.store.search(this.form.getRawValue().username);
	}

	private async sendAndReset(username: string): Promise<void> {
		if (await this.store.sendRequest(username)) {
			this.form.reset();
		}
	}
}
