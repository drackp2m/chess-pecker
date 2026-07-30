import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { FriendUser } from '@app/definition/friendship.interface';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { FriendStore } from '@app/store/friend.store';

@Component({
	templateUrl: './friend.page.html',
	styleUrl: './friend.page.scss',
	imports: [ReactiveFormsModule, InputDirective, ButtonDirective],
})
export class FriendPage implements OnInit {
	readonly store = inject(FriendStore);

	readonly form = new FormGroup({
		username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
	});

	ngOnInit(): void {
		this.store.clearFeedback();
		this.store.clearSearch();
		void this.store.load();
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
