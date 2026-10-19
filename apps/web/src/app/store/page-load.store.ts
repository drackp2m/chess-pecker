import {
	AfterRenderRef,
	DestroyRef,
	Injectable,
	Injector,
	afterNextRender,
	computed,
	inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
	NavigationCancel,
	NavigationEnd,
	NavigationError,
	NavigationSkipped,
	NavigationStart,
	Router,
} from '@angular/router';
import { patchState, signalStore, withState } from '@ngrx/signals';

const LOAD_TIMEOUT_MS = 10000;

interface PageLoadStoreProps {
	isOpen: boolean;
	isNavigating: boolean;
	isSettling: boolean;
	pending: number;
}

const initialState: PageLoadStoreProps = {
	isOpen: false,
	isNavigating: true,
	isSettling: false,
	pending: 0,
};

@Injectable({
	providedIn: 'root',
})
export class PageLoadStore extends signalStore({ protectedState: false }, withState(initialState)) {
	readonly isReady = computed(
		() => this.isOpen() && !this.isNavigating() && !this.isSettling() && 0 === this.pending(),
	);

	private readonly injector = inject(Injector);
	private readonly destroyRef = inject(DestroyRef);
	private readonly loads = new Set<symbol>();

	private settling: AfterRenderRef | undefined;

	constructor() {
		super();

		const router = inject(Router);

		router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
			this.follow(event);
		});
	}

	open(): void {
		patchState(this, { isOpen: true });
		this.settle();
	}

	track<T>(work: Promise<T>): Promise<T> {
		const load = Symbol('load');
		const deadline = setTimeout(() => {
			this.release(load);
		}, LOAD_TIMEOUT_MS);

		this.loads.add(load);
		patchState(this, { pending: this.loads.size });

		return work.finally(() => {
			clearTimeout(deadline);
			this.release(load);
		});
	}

	private follow(event: unknown): void {
		if (event instanceof NavigationStart) {
			this.loads.clear();
			patchState(this, { isNavigating: true, pending: 0 });
		} else if (isNavigationOver(event)) {
			patchState(this, { isNavigating: false });
			this.settle();
		}
	}

	private release(load: symbol): void {
		if (!this.loads.delete(load)) {
			return;
		}

		patchState(this, { pending: this.loads.size });

		if (0 === this.loads.size) {
			this.settle();
		}
	}

	private settle(): void {
		if (this.destroyRef.destroyed) {
			return;
		}

		this.settling?.destroy();
		patchState(this, { isSettling: true });

		this.settling = afterNextRender(
			() => {
				patchState(this, { isSettling: false });
			},
			{ injector: this.injector },
		);
	}
}

function isNavigationOver(event: unknown): boolean {
	return (
		event instanceof NavigationEnd ||
		event instanceof NavigationCancel ||
		event instanceof NavigationError ||
		event instanceof NavigationSkipped
	);
}
