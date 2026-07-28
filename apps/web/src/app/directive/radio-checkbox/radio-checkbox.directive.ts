import {
	AfterViewInit,
	ComponentRef,
	Directive,
	DoCheck,
	ElementRef,
	HostListener,
	TemplateRef,
	ViewContainerRef,
	computed,
	effect,
	inject,
	input,
	signal,
} from '@angular/core';

import {
	RadioCheckboxShellComponent,
	RadioCheckboxShellViewModel,
} from '@app/directive/radio-checkbox/component/radio-checkbox-shell.component';
import { Check } from '@app/util/check';

let nextRadioCheckboxId = 0;

@Directive({
	selector: 'input[appThemed][type=radio], input[appThemed][type=checkbox]',
})
export class RadioCheckboxDirective implements AfterViewInit, DoCheck {
	readonly type = input.required<string>();
	readonly label = input.required<string | TemplateRef<void>>();
	readonly bare = input(false, { transform: Check.isFalseAsStringOrTrue });

	private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
	private readonly viewContainerRef = inject(ViewContainerRef);

	private readonly fallbackInputId = `app-radio-checkbox-${(nextRadioCheckboxId++).toString()}`;

	private readonly shellRef = signal<ComponentRef<RadioCheckboxShellComponent> | null>(null);
	private readonly checkedSignal = signal(false);
	private readonly focusedSignal = signal(false);

	private readonly viewModel = computed<RadioCheckboxShellViewModel>(() => {
		const label = this.label();

		return {
			type: this.type(),
			inputId: this.elementRef.nativeElement.id,
			bare: this.bare(),
			selected: this.checkedSignal(),
			focused: this.focusedSignal(),
			labelText: 'string' === typeof label ? label : undefined,
			labelTemplate: 'string' === typeof label ? undefined : label,
		};
	});

	constructor() {
		effect(() => {
			this.shellRef()?.setInput('viewModel', this.viewModel());
		});
	}

	@HostListener('focus')
	onFocus(): void {
		this.focusedSignal.set(true);
	}

	@HostListener('blur')
	onBlur(): void {
		this.focusedSignal.set(false);
	}

	@HostListener('change')
	onChange(): void {
		this.checkedSignal.set(this.elementRef.nativeElement.checked);
	}

	@HostListener('document:change', ['$event'])
	onDocumentChange(event: Event): void {
		const nativeInput = this.elementRef.nativeElement;
		const target = event.target;

		if (
			'radio' === nativeInput.type &&
			target instanceof HTMLInputElement &&
			target !== nativeInput &&
			target.name === nativeInput.name
		) {
			this.checkedSignal.set(nativeInput.checked);
		}
	}

	ngDoCheck(): void {
		this.checkedSignal.set(this.elementRef.nativeElement.checked);
	}

	ngAfterViewInit(): void {
		const nativeInput = this.elementRef.nativeElement;

		if ('' === nativeInput.id) {
			nativeInput.id = this.fallbackInputId;
		}

		const componentRef = this.viewContainerRef.createComponent(RadioCheckboxShellComponent, {
			projectableNodes: [[nativeInput]],
		});

		componentRef.setInput('viewModel', this.viewModel());
		componentRef.changeDetectorRef.detectChanges();

		this.shellRef.set(componentRef);
	}
}
