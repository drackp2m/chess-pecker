import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { FriendUser } from '@chesspecker/api-definitions';

import { ButtonDirective } from '@app/directive/button.directive';
import { SelectDirective } from '@app/directive/select/select.directive';
import { TextareaDirective } from '@app/directive/textarea.directive';
import { I18n } from '@app/i18n';
import { Modal } from '@app/model/modal.model';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { I18nService } from '@app/service/i18n.service';
import { FriendStore } from '@app/store/friend.store';

/** What the modal was closed with. Nothing at all means it was dismissed. */
export interface ShareChoice {
	/**
	 * Everyone the exercise goes to. It is a list because the API takes one, even though
	 * the select below hands over a single name for now.
	 */
	readonly recipients: readonly FriendUser[];
	/** What was written beside it, empty when nothing was. */
	readonly message: string;
}

/**
 * Picks who a finished exercise is sent to. The friend list comes from `FriendStore`, which
 * the share button warms up beforehand, so the modal opens with it already in place and only
 * refreshes it underneath.
 */
@Component({
	selector: 'app-share-modal',
	templateUrl: './share-modal.component.html',
	styleUrl: './share-modal.component.scss',
	imports: [ButtonDirective, SelectDirective, TextareaDirective, I18nPipe],
})
export class ShareModalComponent extends Modal<ShareChoice | null> implements OnInit {
	protected readonly I18n = I18n;

	private readonly friendStore = inject(FriendStore);
	private readonly i18n = inject(I18nService);

	readonly TITLE = this.i18n.translate(I18n.common.SHARE_TITLE);

	readonly friends = this.friendStore.friends;
	readonly isLoading = computed(() => !this.friendStore.isLoaded());
	readonly hasFailed = computed(() => this.isLoading() && this.friendStore.hasFailed());
	readonly isEmpty = computed(() => !this.isLoading() && 0 === this.friends().length);
	readonly selectPlaceholder = computed(() =>
		this.isLoading() ? I18n.common.LOADING : I18n.common.SELECT_PLACEHOLDER,
	);

	// ToDo => the select carries one value, so a challenge goes to one friend at a time.
	// The API, the request and everything below already take a list: when the select learns
	// to hold several, only `chosen` and this template change.
	private readonly chosen = signal<string | null>(null);
	private readonly draft = signal('');

	readonly message = this.draft.asReadonly();

	readonly recipients = computed<readonly FriendUser[]>(() => {
		const uuid = this.chosen();

		return this.friends().filter((friend) => friend.uuid === uuid);
	});

	readonly canConfirm = computed(() => 0 < this.recipients().length);

	ngOnInit(): void {
		void this.friendStore.refresh();
	}

	selectFriend(event: Event): void {
		const target = event.target;
		const value = target instanceof HTMLSelectElement ? target.value : '';

		this.chosen.set('' === value ? null : value);
	}

	updateMessage(event: Event): void {
		this.draft.set((event.target as HTMLTextAreaElement).value);
	}

	confirm(): void {
		if (!this.canConfirm()) {
			return;
		}

		this.close({ recipients: this.recipients(), message: this.draft().trim() });
	}

	dismiss(): void {
		this.close(null);
	}
}
