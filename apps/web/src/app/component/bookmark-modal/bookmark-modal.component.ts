import { Component, computed, inject, input, signal } from '@angular/core';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import {
	DEFAULT_PUZZLE_BOOKMARK_TYPE,
	PUZZLE_BOOKMARK_LABEL,
	PUZZLE_BOOKMARK_TYPES,
} from '@app/definition/puzzle-bookmark.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RadioCheckboxDirective } from '@app/directive/radio-checkbox/radio-checkbox.directive';
import { I18n } from '@app/i18n';
import { Modal } from '@app/model/modal.model';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BookmarkPreferenceService } from '@app/service/bookmark-preference.service';
import { I18nService } from '@app/service/i18n.service';

/** What the modal was closed with. Nothing at all means it was dismissed. */
export interface BookmarkChoice {
	/** The list to file the exercise under, or nothing to take it out of the one it is in. */
	readonly type: PuzzleBookmarkType | null;
	/** Whether a press files a favorite outright from now on, without asking. */
	readonly skipPrompt: boolean;
}

@Component({
	selector: 'app-bookmark-modal',
	templateUrl: './bookmark-modal.component.html',
	imports: [ButtonDirective, RadioCheckboxDirective, I18nPipe],
})
export class BookmarkModalComponent extends Modal<BookmarkChoice | null> {
	protected readonly I18n = I18n;

	readonly types = PUZZLE_BOOKMARK_TYPES;
	readonly typeLabel = PUZZLE_BOOKMARK_LABEL;

	/**
	 * Handed over with `setInput` once the modal is up: `ModalStore.open` answers with a
	 * `Modal<T>`, so there is no typed way in.
	 */
	readonly current = input<PuzzleBookmarkType | null>(null);

	private readonly i18n = inject(I18nService);
	private readonly preference = inject(BookmarkPreferenceService);

	readonly TITLE = this.i18n.translate(I18n.common.BOOKMARK_TITLE);

	private readonly chosen = signal<PuzzleBookmarkType | null>(null);
	private readonly remember = signal(!this.preference.isPromptEnabled());

	/** The list already filed under, until the modal is touched. */
	readonly selected = computed(
		() => this.chosen() ?? this.current() ?? DEFAULT_PUZZLE_BOOKMARK_TYPE,
	);

	/** What a press does from now on, which is a matter apart from where this one goes. */
	readonly skipPrompt = this.remember.asReadonly();

	readonly isFiled = computed(() => null !== this.current());

	select(type: PuzzleBookmarkType): void {
		this.chosen.set(type);
	}

	toggleSkipPrompt(event: Event): void {
		const target = event.target;

		this.remember.set(target instanceof HTMLInputElement && target.checked);
	}

	confirm(): void {
		this.close({ type: this.selected(), skipPrompt: this.skipPrompt() });
	}

	remove(): void {
		this.close({ type: null, skipPrompt: this.skipPrompt() });
	}

	dismiss(): void {
		this.close(null);
	}
}
