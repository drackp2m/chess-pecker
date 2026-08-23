import {
	AfterViewInit,
	ComponentRef,
	Directive,
	DoCheck,
	ElementRef,
	HostListener,
	Renderer2,
	ViewContainerRef,
	computed,
	effect,
	inject,
	input,
	signal,
} from '@angular/core';

import {
	SegmentShellComponent,
	SegmentShellViewModel,
} from '@app/directive/segment/component/segment-shell.component';

const HIDDEN_INPUT_STYLE: Readonly<Record<string, string>> = {
	position: 'absolute',
	width: '1px',
	height: '1px',
	margin: '0',
	opacity: '0',
	pointerEvents: 'none',
};

@Directive({
	selector: 'input[appSegment][type=radio]',
})
export class SegmentDirective implements AfterViewInit, DoCheck {
	readonly label = input.required<string>();

	private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
	private readonly viewContainerRef = inject(ViewContainerRef);
	private readonly renderer2 = inject(Renderer2);

	private readonly controlId =
		'' === this.elementRef.nativeElement.id
			? `segment-${crypto.randomUUID()}`
			: this.elementRef.nativeElement.id;

	private readonly shellRef = signal<ComponentRef<SegmentShellComponent> | null>(null);
	private readonly checkedSignal = signal(false);
	private readonly disabledSignal = signal(false);
	private readonly focusedSignal = signal(false);

	readonly checked = this.checkedSignal.asReadonly();

	readonly element = computed<HTMLElement | undefined>(() => {
		const location: ElementRef<HTMLElement> | undefined = this.shellRef()?.location;

		return location?.nativeElement;
	});

	private readonly viewModel = computed<SegmentShellViewModel>(() => ({
		controlId: this.controlId,
		label: this.label(),
		selected: this.checkedSignal(),
		disabled: this.disabledSignal(),
		focused: this.focusedSignal(),
	}));

	constructor() {
		effect(() => {
			this.shellRef()?.setInput('viewModel', this.viewModel());
		});
	}

	@HostListener('focus')
	onFocus(): void {
		this.focusedSignal.set(this.elementRef.nativeElement.matches(':focus-visible'));
	}

	@HostListener('blur')
	onBlur(): void {
		this.focusedSignal.set(false);
	}

	ngDoCheck(): void {
		const nativeInput = this.elementRef.nativeElement;

		this.checkedSignal.set(nativeInput.checked);
		this.disabledSignal.set(nativeInput.disabled);
	}

	ngAfterViewInit(): void {
		const nativeInput = this.elementRef.nativeElement;

		this.renderer2.setAttribute(nativeInput, 'id', this.controlId);

		for (const [property, value] of Object.entries(HIDDEN_INPUT_STYLE)) {
			this.renderer2.setStyle(nativeInput, property, value);
		}

		const componentRef = this.viewContainerRef.createComponent(SegmentShellComponent, {
			projectableNodes: [[nativeInput]],
		});

		componentRef.setInput('viewModel', this.viewModel());
		componentRef.changeDetectorRef.detectChanges();

		this.shellRef.set(componentRef);
	}
}
