import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FriendUser } from '@chesspecker/api-definitions';

import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { ProfileStore } from '@app/store/profile.store';
import { SessionStore } from '@app/store/session.store';

@Component({
	templateUrl: './profile.page.html',
	styleUrl: './profile.page.scss',
	imports: [ReactiveFormsModule, InputDirective, ButtonDirective, I18nPipe],
})
export class ProfilePage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(ProfileStore);
	readonly session = inject(SessionStore);

	readonly form = new FormGroup({
		username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
	});

	ngOnInit(): void {
		this.store.clearFeedback();
		this.store.clearSearch();
		void this.store.load();
	}

	logOut(): void {
		void this.session.logOut();
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
