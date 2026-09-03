import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FriendUser, PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { PUZZLE_BOOKMARK_LABEL, PUZZLE_BOOKMARK_TYPES } from '@app/definition/puzzle-bookmark.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BookmarkStore } from '@app/store/bookmark.store';
import { ProfileStore } from '@app/store/profile.store';
import { SessionStore } from '@app/store/session.store';
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
	readonly bookmarkTypes = PUZZLE_BOOKMARK_TYPES;
	readonly bookmarkLabels = PUZZLE_BOOKMARK_LABEL;

	private readonly logOutUseCase = inject(LogOutUseCase);

	readonly form = new FormGroup({
		username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
	});

	ngOnInit(): void {
		this.store.clearFeedback();
		this.store.clearSearch();
		void this.store.load();
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
