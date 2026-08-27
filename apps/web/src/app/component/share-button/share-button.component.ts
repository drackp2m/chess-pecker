import { Component, computed, inject } from '@angular/core';
import type { PuzzleShareResultRequest } from '@chesspecker/api-definitions';
import { firstValueFrom } from 'rxjs';

import { ShareChoice, ShareModalComponent } from '@app/component/share-modal/share-modal.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { I18n, i18nRef } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { PuzzleShareRepository } from '@app/repository/puzzle-share.repository';
import { NotificationService } from '@app/service/notification.service';
import { ModalStore } from '@app/store/modal.store';

/**
 * Sends a finished exercise to a friend as a challenge, with the sender's own numbers
 * attached so the comparison has something on it from the start. The board is read off
 * `PuzzleStore`, the same one the row this button sits in is driven by.
 */
@Component({
	selector: 'app-share-button',
	templateUrl: './share-button.component.html',
	styleUrl: './share-button.component.scss',
	imports: [ButtonDirective, I18nPipe],
})
export class ShareButtonComponent {
	protected readonly I18n = I18n;

	private readonly store = inject(PuzzleStore);
	private readonly repository = inject(PuzzleShareRepository);
	private readonly notificationService = inject(NotificationService);
	private readonly modalStore = inject(ModalStore);

	/** Only a finished exercise is worth sending: there is nothing to compare until it is. */
	readonly isDisabled = computed(() => undefined === this.store.puzzle() || this.store.isOpen());

	async onClick(): Promise<void> {
		if (this.isDisabled()) {
			return;
		}

		const modal = await this.modalStore.open(ShareModalComponent);
		const choice = await firstValueFrom(modal.instance.onClose$);

		if (null !== choice) {
			await this.send(choice);
		}
	}

	private async send(choice: ShareChoice): Promise<void> {
		const puzzle = this.store.puzzle();
		const result = this.buildResult();

		if (undefined === puzzle || undefined === result) {
			return;
		}

		// ToDo => `attemptUuid` is not sent yet: the training attempt's uuid lives in
		// `TrainingSolveSession` and never reaches this row. The API already takes it, and
		// filling it is what points a challenge back at the attempt it came out of.
		try {
			await this.repository.create({
				lichessId: puzzle.id,
				recipientUuids: choice.recipients.map((friend) => friend.uuid),
				...('' === choice.message ? {} : { message: choice.message }),
				result,
			});

			this.notificationService.notify(
				i18nRef(I18n.common.SHARE_SENT, {
					username: choice.recipients.map((friend) => friend.username).join(', '),
				}),
			);
		} catch (error: unknown) {
			console.error('Could not share the exercise', error);
			this.notificationService.notify(i18nRef(I18n.common.SHARE_ERROR));
		}
	}

	/**
	 * ToDo => the standalone board runs no clock, so `durationMs` is left out: only a
	 * training times an attempt today, and a made-up number would poison the comparison.
	 */
	private buildResult(): PuzzleShareResultRequest | undefined {
		const closure = this.store.closure();

		if ('open' === closure) {
			return undefined;
		}

		return {
			solved: 'solved' === this.store.result(),
			closure,
			hintUsed: this.store.hintUsed(),
			mistakeCount: this.store.mistakeCount(),
		};
	}
}
