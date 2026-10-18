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
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SyncStore } from '@app/store/sync.store';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	imports: [RouterOutlet, ReactiveFormsModule, ModalOutletComponent, SplashScreenComponent],
	providers: [],
	host: {
		'(click)': 'releaseSplash()',
	},
})
export class AppComponent {
	title = 'chesspecker';

	private readonly sync = inject(SyncStore);

	private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');

	private readonly isSplashHeld = signal(!this.sync.isReady());

	/**
	 * The boot gate, closed only by a download: anything painted over a half-replica would be
	 * wrong. What is left to upload is already here, so it waits for nobody.
	 */
	readonly loading = computed(() => !this.sync.isReady() || this.isSplashHeld());

	constructor() {
		effect((onCleanup) => {
			if (!this.sync.isReady()) {
				return;
			}

			const linger = setTimeout(() => {
				this.isSplashHeld.set(false);
			}, SyncPolicy.splashLingerMs);

			onCleanup(() => {
				clearTimeout(linger);
			});
		});
	}

	protected reveal(event: AnimationCallbackEvent): void {
		void revealApp(event.target, this.stage().nativeElement).finally(() => {
			event.animationComplete();
		});
	}

	protected releaseSplash(): void {
		if (this.sync.isReady()) {
			this.isSplashHeld.set(false);
		}
	}
}
