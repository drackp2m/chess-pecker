import {
	Component,
	ElementRef,
	OnDestroy,
	afterNextRender,
	computed,
	inject,
	signal,
	viewChild,
} from '@angular/core';

import { kingHalo } from '@app/component/splash-screen/king-halo';
import { animateKing } from '@app/component/splash-screen/king-motion';
import { kingClip } from '@app/component/splash-screen/king-outline';
import { kingShadow } from '@app/component/splash-screen/king-shadow';
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
	selector: 'app-splash-screen',
	templateUrl: './splash-screen.component.html',
	styleUrl: './splash-screen.component.scss',
	imports: [I18nPipe],
})
export class SplashScreenComponent implements OnDestroy {
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

	private readonly face = viewChild.required<ElementRef<HTMLElement>>('face');

	private readonly halo = viewChild.required<ElementRef<HTMLCanvasElement>>('halo');

	private readonly shading = viewChild.required<ElementRef<HTMLCanvasElement>>('shading');

	// The delay counts only the time the tab is visible, which is the only time the user has
	// spent waiting.
	private readonly delay = new WatchedDelay();

	constructor() {
		this.delay.start(SyncPolicy.splashDetailMs, () => {
			this.waited.set(true);
		});

		document.addEventListener('visibilitychange', this.onVisibilityChange);

		afterNextRender(() => {
			const face = this.face().nativeElement;

			animateKing(face, [
				kingClip(face),
				kingHalo(this.halo().nativeElement),
				kingShadow(this.shading().nativeElement),
			]);
		});
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
