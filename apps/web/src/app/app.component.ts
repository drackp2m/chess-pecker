import {
	AnimationCallbackEvent,
	Component,
	ElementRef,
	computed,
	effect,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

import { ModalOutletComponent } from '@app/component/modal-outlet/modal-outlet.component';
import { revealApp } from '@app/component/splash-screen/splash-reveal';
import { SplashScreenComponent } from '@app/component/splash-screen/splash-screen.component';
import { PageLoadStore } from '@app/store/page-load.store';
import { SyncStore } from '@app/store/sync.store';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	imports: [RouterOutlet, ReactiveFormsModule, ModalOutletComponent, SplashScreenComponent],
	providers: [],
})
export class AppComponent {
	title = 'chesspecker';

	protected readonly pageLoad = inject(PageLoadStore);

	private readonly sync = inject(SyncStore);

	private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');

	private readonly isRevealed = signal(false);

	readonly loading = computed(() => !this.isRevealed());

	constructor() {
		this.openPagesOnSync();

		effect(() => {
			if (this.pageLoad.isReady()) {
				this.isRevealed.set(true);
			}
		});
	}

	protected reveal(event: AnimationCallbackEvent): void {
		void revealApp(event.target, this.stage().nativeElement).finally(() => {
			event.animationComplete();
		});
	}

	/**
	 * The boot gate, closed only by a download: anything painted over a half-replica would be
	 * wrong. What is left to upload is already here, so it waits for nobody.
	 */
	private openPagesOnSync(): void {
		effect(() => {
			if (this.sync.isReady()) {
				this.pageLoad.open();
			}
		});
	}
}
