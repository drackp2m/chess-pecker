import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FriendUser } from '@chesspecker/api-definitions';

import { AvatarComponent } from '@app/component/avatar/avatar.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { PageLoadStore } from '@app/store/page-load.store';
import { ProfileStore } from '@app/store/profile.store';

@Component({
	templateUrl: './profile-friends.page.html',
	styleUrl: './profile-friends.page.scss',
	imports: [AvatarComponent, ReactiveFormsModule, InputDirective, ButtonDirective, I18nPipe],
	providers: [provideI18nScope('profile')],
})
export class ProfileFriendsPage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(ProfileStore);

	private readonly pageLoad = inject(PageLoadStore);

	readonly form = new FormGroup({
		username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
	});

	ngOnInit(): void {
		this.store.clearFeedback();
		this.store.clearSearch();
		void this.pageLoad.track(this.store.load());
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
