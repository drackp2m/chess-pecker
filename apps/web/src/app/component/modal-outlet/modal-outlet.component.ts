import {
	AfterViewInit,
	Component,
	ComponentRef,
	Renderer2,
	Type,
	ViewContainerRef,
	computed,
	inject,
	signal,
	viewChild,
} from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { Modal } from '@app/model/modal.model';
import { ModalStore } from '@app/store/modal.store';
import { Async } from '@app/util/async';

@Component({
	selector: 'app-modal-outlet',
	templateUrl: './modal-outlet.component.html',
	styleUrl: './modal-outlet.component.scss',
	imports: [ButtonDirective],
})
export class ModalOutletComponent implements AfterViewInit {
	private readonly modalContent = viewChild.required('modalContent', {
		read: ViewContainerRef,
	});

	private readonly modalStore = inject(ModalStore);
	private readonly renderer2 = inject(Renderer2);

	activeComponentRef: ComponentRef<unknown> | null = null;

	readonly modalState = signal<'hidden' | 'transitioning' | 'visible'>('hidden');
	readonly title = signal('');
	readonly isInTransition = signal(false);

	// Single source of truth for the template: one enumerated state (reflected as
	// `data-state`) drives every CSS transition, instead of stacking booleans.
	readonly outletState = computed<'closed' | 'closing' | 'opening' | 'open'>(() => {
		const state = this.modalState();

		if ('visible' === state) {
			return 'open';
		}

		if ('transitioning' === state) {
			return 'opening';
		}

		return this.isInTransition() ? 'closing' : 'closed';
	});

	ngAfterViewInit() {
		this.modalStore.initializeContainer(this);
	}

	getModalContent(): ViewContainerRef {
		return this.modalContent();
	}

	async open<T>(component: Type<Modal<T>>): Promise<ComponentRef<Modal<T>>> {
		this.modalState.set('transitioning');

		await Async.waitForFrames();

		const modalContent = this.modalContent();
		const animationInProgress = this.isInTransition();
		const modalState = this.modalState();

		if (!animationInProgress && 'visible' === modalState) {
			return Promise.reject(new Error('Modal is already open'));
		}

		this.isInTransition.set(true);

		this.cleanupModal();

		const componentRef = modalContent.createComponent(component);
		this.activeComponentRef = componentRef;

		this.title.set(componentRef.instance.TITLE);
		this.renderer2.addClass(componentRef.location.nativeElement, 'modal');

		// Let the browser paint the container at its resting transform before
		// flipping to `visible`, so the CSS transition actually runs.
		await Async.waitForFrames(2);

		this.modalState.set('visible');

		return componentRef;
	}

	close(): void {
		const modalState = this.modalState();

		if ('visible' === modalState) {
			this.isInTransition.set(true);
			this.modalState.set('hidden');
		}
	}

	onTransitionEnd(event: TransitionEvent): void {
		if (event.target !== event.currentTarget || 'transform' !== event.propertyName) {
			return;
		}

		this.isInTransition.set(false);

		if ('hidden' === this.modalState()) {
			this.cleanupModal();
		}
	}

	private cleanupModal(): void {
		const modalContent = this.modalContent();

		if (null !== this.activeComponentRef) {
			this.activeComponentRef.destroy();
			this.activeComponentRef = null;
		}

		modalContent.clear();
	}
}
