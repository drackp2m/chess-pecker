import { Component, OnDestroy, computed, inject, signal } from '@angular/core';

import { SvgComponent } from '@app/component/svg/svg.component';
import { SYNC_PHASE_LABEL } from '@app/definition/sync-phase.type';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { SyncStore } from '@app/store/sync.store';
import { WatchedDelay } from '@app/util/watched-delay';

/**
 * What shows while the app cannot serve data yet. The detail only appears once the wait is
 * long enough not to be a flicker: the normal case, nothing pending, shows nothing.
 */
@Component({
	selector: 'app-sync-splash',
	templateUrl: './sync-splash.component.html',
	styleUrl: './sync-splash.component.scss',
	imports: [I18nPipe, SvgComponent],
})
export class SyncSplashComponent implements OnDestroy {
	protected readonly I18n = I18n;

	protected readonly sync = inject(SyncStore);

	protected readonly message = computed(() => SYNC_PHASE_LABEL[this.sync.phase()]);

	protected readonly isDownloading = computed(
		() => 'pulling' === this.sync.phase() && 0 < this.sync.behind().length,
	);

	protected readonly isSweeping = computed(
		() => 0 < this.sync.catalogTotal() && this.sync.catalogDone() < this.sync.catalogTotal(),
	);

	protected readonly showDetail = computed(
		() => this.waited() && (this.sync.hasPending() || this.isDownloading() || this.isSweeping()),
	);

	private readonly waited = signal(false);

	// The delay counts only the time the tab is visible, which is the only time the user has
	// spent waiting.
	private readonly delay = new WatchedDelay();

	constructor() {
		this.delay.start(SyncPolicy.splashDetailMs, () => {
			this.waited.set(true);
		});

		document.addEventListener('visibilitychange', this.onVisibilityChange);
	}

	ngOnDestroy(): void {
		this.delay.cancel();
		document.removeEventListener('visibilitychange', this.onVisibilityChange);
	}

	private readonly onVisibilityChange = (): void => {
		if ('visible' === document.visibilityState) {
			this.delay.resume();
		} else {
			this.delay.pause();
		}
	};
}
