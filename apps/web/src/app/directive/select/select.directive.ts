import {
	AfterViewInit,
	ComponentRef,
	Directive,
	ElementRef,
	HostListener,
	Injector,
	OnDestroy,
	TemplateRef,
	ViewContainerRef,
	booleanAttribute,
	effect,
	inject,
	input,
} from '@angular/core';

import { SelectShellComponent } from '@app/directive/select/component/select-shell.component';
import { SelectInteractionHandler } from '@app/directive/select/select-interaction-handler';
import { SelectNativeAdapter } from '@app/directive/select/select-native-adapter';
import { SelectOutsideDismissal } from '@app/directive/select/select-outside-dismissal';
import { SelectOptionViewModel, SelectStore } from '@app/directive/select/select.store';

let nextSelectId = 0;

/**
 * Progressive enhancement over a native `<select>`: keeps the native element
 * as the form's source of truth (value, options) while the themed shell
 * renders a combobox around it — a real search input that owns focus and
 * keyboard, plus a custom dropdown. Orchestrates the store, the shell
 * component and the interaction handler.
 */
@Directive({
	selector: 'select[appThemed]',
	providers: [SelectStore],
})
export class SelectDirective implements AfterViewInit, OnDestroy {
	readonly label = input.required<string>();
	readonly placeholder = input('Choose an option');
	readonly searchable = input<boolean | null, unknown>(null, { transform: booleanAttribute });
	readonly maxVisibleOptions = input(9);
	readonly optionTemplate = input<TemplateRef<{ $implicit: SelectOptionViewModel }>>();

	private readonly elementRef = inject<ElementRef<HTMLSelectElement>>(ElementRef);
	private readonly viewContainerRef = inject(ViewContainerRef);
	private readonly injector = inject(Injector);
	private readonly store = inject(SelectStore);
	private readonly nativeAdapter = new SelectNativeAdapter(this.elementRef.nativeElement);

	private readonly interaction = new SelectInteractionHandler(this.store, {
		openDropdown: () => {
			this.openDropdown();
		},
		closeDropdown: () => {
			this.closeDropdown();
		},
		selectOption: (value) => {
			this.selectOption(value);
		},
	});

	private readonly dismissal = new SelectOutsideDismissal(this.store, {
		isInsideShell: (target) => this.shellElement?.contains(target) ?? false,
		closeDropdown: () => {
			this.closeDropdown();
		},
	});

	private shellRef: ComponentRef<SelectShellComponent> | null = null;
	private shellElement: HTMLElement | null = null;

	constructor() {
		effect(() => {
			const label = this.label();
			const placeholder = this.placeholder();
			const maxVisibleOptions = this.maxVisibleOptions();
			const optionTemplate = this.optionTemplate();

			this.shellRef?.setInput('label', label);
			this.shellRef?.setInput('placeholder', placeholder);
			this.shellRef?.setInput('maxVisibleOptions', maxVisibleOptions);
			this.shellRef?.setInput('optionTemplate', optionTemplate);
			this.store.setSearchableOverride(this.searchable());
		});
	}

	@HostListener('input')
	@HostListener('change')
	onNativeValueChange() {
		this.store.updateSelection(this.nativeAdapter.getValue(), this.nativeAdapter.getSelectedText());
	}

	ngAfterViewInit(): void {
		this.nativeAdapter.hide();
		this.syncFromNativeSelect();
		this.nativeAdapter.observeValueWrites(() => {
			this.onNativeValueChange();
		});
		this.nativeAdapter.observeOptionChanges(() => {
			this.syncFromNativeSelect();
		});
		this.createShell();
	}

	ngOnDestroy(): void {
		this.nativeAdapter.stopObservingOptionChanges();
		this.dismissal.detach();
	}

	private syncFromNativeSelect(): void {
		const disabled = this.nativeAdapter.isDisabled();

		this.nativeAdapter.ensurePlaceholder(this.placeholder());
		this.store.setOptionsFromSelect(this.elementRef.nativeElement);
		this.store.setDisabled(disabled);
		this.onNativeValueChange();

		if (disabled && this.store.isOpen()) {
			this.closeDropdown();
		}
	}

	private createShell(): void {
		const selectId = this.nativeAdapter.ensureId(`app-select-${(nextSelectId++).toString()}`);
		const componentRef = this.viewContainerRef.createComponent(SelectShellComponent, {
			injector: this.injector,
			projectableNodes: [[this.elementRef.nativeElement]],
		});

		componentRef.setInput('label', this.label());
		componentRef.setInput('selectId', selectId);
		componentRef.setInput('placeholder', this.placeholder());
		componentRef.setInput('maxVisibleOptions', this.maxVisibleOptions());
		componentRef.setInput('optionTemplate', this.optionTemplate());

		componentRef.instance.optionSelected.subscribe((value) => {
			this.selectOption(value);
		});
		componentRef.instance.toggleRequested.subscribe(() => {
			this.toggleDropdown();
		});
		componentRef.instance.searchKeydown.subscribe((event) => {
			this.interaction.handleKeydown(event);
		});
		componentRef.instance.closeRequested.subscribe(() => {
			if (this.store.isOpen()) {
				this.closeDropdown();
			}
		});

		componentRef.changeDetectorRef.detectChanges();

		this.shellRef = componentRef;
		this.shellElement = componentRef.location.nativeElement as HTMLElement;
	}

	private toggleDropdown(): void {
		if (this.store.disabled()) {
			return;
		}

		this.shellRef?.instance.focusSearchInput();

		if (this.store.isOpen()) {
			this.closeDropdown();

			return;
		}

		this.openDropdown();
	}

	private openDropdown(): void {
		this.store.openDropdown();
		this.dismissal.attach();
	}

	private closeDropdown(): void {
		this.store.closeDropdown();
		this.dismissal.detach();
	}

	private selectOption(value: string): void {
		this.nativeAdapter.applyValue(value);
		this.closeDropdown();
	}
}
