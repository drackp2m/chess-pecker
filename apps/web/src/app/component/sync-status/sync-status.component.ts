import { Component, computed, effect, inject, signal } from '@angular/core';

import { SYNC_ENTITY_LABEL } from '@app/definition/sync-entity.constant';
import { SYNC_PHASE_LABEL, isSettledPhase } from '@app/definition/sync-phase.type';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { ButtonDirective } from '@app/directive/button.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { LanguageService } from '@app/service/language.service';
import { SessionStore } from '@app/store/session.store';
import { SyncStore } from '@app/store/sync.store';
import { SyncAuditReport, SyncAuditUseCase } from '@app/use-case/sync/sync-audit.use-case';

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
	selector: 'app-sync-status',
	templateUrl: './sync-status.component.html',
	styleUrl: './sync-status.component.scss',
	imports: [ButtonDirective, I18nPipe],
})
export class SyncStatusComponent {
	protected readonly I18n = I18n;
	protected readonly entityLabel = SYNC_ENTITY_LABEL;
	protected readonly staleDays = Math.round(SyncPolicy.staleAfterMs / DAY_MS);

	protected readonly session = inject(SessionStore);
	protected readonly sync = inject(SyncStore);

	protected readonly report = signal<SyncAuditReport | null>(null);

	protected readonly phase = computed(() => SYNC_PHASE_LABEL[this.sync.phase()]);

	protected readonly hidden = computed(() => {
		const report = this.report();

		return null === report ? 0 : report.rejected - report.rejections.length;
	});

	private readonly isReading = signal(false);

	protected readonly isBusy = computed(() => this.sync.isSyncing() || this.isReading());

	private readonly audit = inject(SyncAuditUseCase);
	private readonly language = inject(LanguageService);

	private readonly formatter = computed(
		() =>
			new Intl.DateTimeFormat(this.language.selectedLanguage(), {
				dateStyle: 'medium',
				timeStyle: 'short',
			}),
	);

	constructor() {
		effect(() => {
			const phase = this.sync.phase();

			if ('idle' === phase || isSettledPhase(phase)) {
				void this.read();
			}
		});
	}

	protected format(date: Date | null): string {
		return null === date ? '' : this.formatter().format(date);
	}

	protected async force(): Promise<void> {
		await this.sync.sync();
		await this.read();
	}

	protected async retryRejected(): Promise<void> {
		try {
			await this.audit.requeueRejected();
		} catch (error) {
			console.error('Could not queue the rejected rows again', error);

			return;
		}

		await this.force();
	}

	private async read(): Promise<void> {
		this.isReading.set(true);

		try {
			this.report.set(await this.audit.read());
		} catch (error) {
			console.error('Could not read the sync status', error);
		} finally {
			this.isReading.set(false);
		}
	}
}
