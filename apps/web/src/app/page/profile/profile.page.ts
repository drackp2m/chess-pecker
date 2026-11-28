import { Component, OnInit, computed, effect, inject, untracked } from '@angular/core';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { AvatarComponent } from '@app/component/avatar/avatar.component';
import {
	CHALLENGE_DIRECTIONS,
	CHALLENGE_DIRECTION_LABEL,
	ChallengeDirection,
} from '@app/definition/challenge.type';
import { PUZZLE_BOOKMARK_LABEL, PUZZLE_BOOKMARK_TYPES } from '@app/definition/puzzle-bookmark.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BookmarkStore } from '@app/store/bookmark.store';
import { PageLoadStore } from '@app/store/page-load.store';
import { ReceivedShareStore } from '@app/store/received-share.store';
import { SessionStore } from '@app/store/session.store';
import { ShareStore } from '@app/store/share.store';

@Component({
	templateUrl: './profile.page.html',
	styleUrl: './profile.page.scss',
	imports: [AvatarComponent, RouterLinkDirective, ButtonDirective, I18nPipe],
	providers: [provideI18nScope('profile')],
})
export class ProfilePage implements OnInit {
	protected readonly I18n = I18n;

	readonly session = inject(SessionStore);
	readonly bookmarks = inject(BookmarkStore);
	readonly bookmarkLabels = PUZZLE_BOOKMARK_LABEL;
	readonly challengeLabels = CHALLENGE_DIRECTION_LABEL;

	private readonly shares = inject(ShareStore);
	private readonly receivedShares = inject(ReceivedShareStore);
	private readonly pageLoad = inject(PageLoadStore);

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

	constructor() {
		effect(() => {
			if (this.session.isAuthenticated()) {
				untracked(() => {
					void this.receivedShares.refresh();
				});
			}
		});
	}

	ngOnInit(): void {
		void this.pageLoad.track(this.bookmarks.ready());
		void this.pageLoad.track(this.shares.ready());
	}

	retryConnection(): void {
		void this.session.retry();
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
}
