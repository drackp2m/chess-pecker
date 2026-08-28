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
import { I18n } from '@app/i18n';

let nextSelectId = 0;

/**
 * Progressive enhancement over a native `<select>`, which stays the form's source of truth
 * while the shell renders a combobox around it: a real search input plus a custom dropdown.
 */
@Directive({
	selector: 'select[appThemed]',
	providers: [SelectStore],
})
export class SelectDirective implements AfterViewInit, OnDestroy {
	readonly label = input.required<string>();
	readonly placeholder = input<string>(I18n.common.SELECT_PLACEHOLDER);
	readonly searchable = input<boolean | null, unknown>(null, { transform: booleanAttribute });
	readonly chips = input(false, { transform: booleanAttribute });
	readonly multiline = input(false, { transform: booleanAttribute });
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
			const inputs = this.readShellInputs();

			this.store.setSearchableOverride(this.searchable());

			if (null !== this.shellRef) {
				this.applyShellInputs(this.shellRef, inputs);
			}
		});
	}

	@HostListener('input')
	@HostListener('change')
	onNativeValueChange() {
		this.store.updateSelection(this.nativeAdapter.getSelectedValues());
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

		this.store.setMultiple(this.nativeAdapter.isMultiple());
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

		componentRef.setInput('selectId', selectId);

		this.applyShellInputs(componentRef, this.readShellInputs());
		this.bindShellOutputs(componentRef);

		componentRef.changeDetectorRef.detectChanges();

		this.shellRef = componentRef;
		this.shellElement = componentRef.location.nativeElement as HTMLElement;
	}

	private readShellInputs(): Record<string, unknown> {
		return {
			label: this.label(),
			placeholder: this.placeholder(),
			maxVisibleOptions: this.maxVisibleOptions(),
			optionTemplate: this.optionTemplate(),
			chips: this.chips(),
			multiline: this.multiline(),
		};
	}

	private applyShellInputs(
		componentRef: ComponentRef<SelectShellComponent>,
		inputs: Record<string, unknown>,
	): void {
		for (const [name, value] of Object.entries(inputs)) {
			componentRef.setInput(name, value);
		}
	}

	private bindShellOutputs(componentRef: ComponentRef<SelectShellComponent>): void {
		const shell = componentRef.instance;

		shell.optionSelected.subscribe((value) => {
			this.selectOption(value);
		});
		shell.optionRemoved.subscribe((value) => {
			this.nativeAdapter.deselectOption(value);
		});
		shell.toggleRequested.subscribe(() => {
			this.toggleDropdown();
		});
		shell.searchKeydown.subscribe((event) => {
			this.interaction.handleKeydown(event);
		});
		shell.closeRequested.subscribe(() => {
			if (this.store.isOpen()) {
				this.closeDropdown();
			}
		});
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
		if (this.store.multiple()) {
			this.nativeAdapter.toggleOption(value);

			return;
		}

		this.nativeAdapter.applyValue(value);
		this.closeDropdown();
	}
}
