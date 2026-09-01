import { Component, computed, inject, input } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
	BookmarkChoice,
	BookmarkModalComponent,
} from '@app/component/bookmark-modal/bookmark-modal.component';
import { DEFAULT_PUZZLE_BOOKMARK_TYPE } from '@app/definition/puzzle-bookmark.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { LongPressDirective } from '@app/directive/long-press.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BookmarkPreferenceService } from '@app/service/bookmark-preference.service';
import { BookmarkStore } from '@app/store/bookmark.store';
import { ModalStore } from '@app/store/modal.store';

/**
 * Files a finished exercise under one of the lists. A press either asks where it goes or
 * files it under favorites outright; holding always asks, which is how the question comes
 * back once it has been turned off.
 */
@Component({
	selector: 'app-bookmark-button',
	templateUrl: './bookmark-button.component.html',
	styleUrl: './bookmark-button.component.scss',
	imports: [ButtonDirective, LongPressDirective, I18nPipe],
})
export class BookmarkButtonComponent {
	protected readonly I18n = I18n;

	readonly lichessId = input.required<string>();
	readonly isDisabled = input(false);

	private readonly store = inject(BookmarkStore);
	private readonly preference = inject(BookmarkPreferenceService);
	private readonly modalStore = inject(ModalStore);

	readonly filedAs = computed(() => this.store.typeOf(this.lichessId()));

	readonly isFiled = computed(() => undefined !== this.filedAs());

	readonly isHighlighted = computed(() => this.isFiled() && !this.isDisabled());

	readonly label = computed(() =>
		this.isFiled() ? I18n.common.BOOKMARK_EDIT : I18n.common.BOOKMARK_ADD,
	);

	/** A press asks unless the question has been turned off, and then it files a favorite. */
	async onPress(): Promise<void> {
		if (this.isDisabled()) {
			return;
		}

		if (this.preference.isPromptEnabled()) {
			await this.ask();

			return;
		}

		if (this.isFiled()) {
			await this.store.unfile(this.lichessId());

			return;
		}

		await this.store.file(this.lichessId(), DEFAULT_PUZZLE_BOOKMARK_TYPE);
	}

	async onHold(): Promise<void> {
		if (this.isDisabled()) {
			return;
		}

		await this.ask();
	}

	private async ask(): Promise<void> {
		const modal = await this.modalStore.open(BookmarkModalComponent);

		modal.setInput('current', this.filedAs() ?? null);

		const choice = await firstValueFrom(modal.instance.onClose$);

		if (null !== choice) {
			await this.apply(choice);
		}
	}

	private async apply({ type, skipPrompt }: BookmarkChoice): Promise<void> {
		const shouldPrompt = !skipPrompt;

		if (shouldPrompt !== this.preference.isPromptEnabled()) {
			this.preference.updatePrompt(shouldPrompt);
		}

		if (null === type) {
			await this.store.unfile(this.lichessId());

			return;
		}

		await this.store.file(this.lichessId(), type);
	}
}
