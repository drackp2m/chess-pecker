import {
	AfterViewInit,
	DestroyRef,
	Directive,
	ElementRef,
	HostListener,
	OnInit,
	Renderer2,
	afterRenderEffect,
	effect,
	inject,
	input,
} from '@angular/core';

import { elementOffsetHeight, elementOffsetWidth } from '@app/util/element-size';
import { createTypedElement } from '@app/util/renderer';

export type ThemedFieldControl = HTMLInputElement | HTMLTextAreaElement;

let nextFieldId = 0;

/**
 * The floating-label shell every themed field shares: the wrapper, the notched border and
 * the two label copies. What sits inside it — an input, a textarea — only adds its own
 * sizing on top.
 */
@Directive()
export abstract class ThemedFieldDirective<TControl extends ThemedFieldControl>
	implements OnInit, AfterViewInit
{
	readonly label = input('');
	readonly placeholder = input('');

	protected readonly elementRef = inject<ElementRef<TControl>>(ElementRef);
	protected readonly renderer2 = inject(Renderer2);

	protected readonly wrapperElement: HTMLDivElement = this.createWrapper();

	private readonly destroyRef = inject(DestroyRef);

	private readonly labelSpanElement: HTMLSpanElement = this.createLabelMeasure();
	private readonly labelElement: HTMLLabelElement = this.createLabel();
	private readonly fakeLabelElement: HTMLSpanElement = this.createFakeLabel();
	private readonly borderContainerElement: HTMLDivElement = this.createBorderContainer();

	/**
	 * The label width is not static — async translations, language changes, late web fonts —
	 * so the measure span and the wrapper are re-measured on every size change.
	 */
	private readonly labelWidth = elementOffsetWidth(() => this.labelSpanElement);

	protected readonly wrapperHeight = elementOffsetHeight(() => this.wrapperElement);

	/** The class the global stylesheet hangs the shell off, and the prefix of a generated id. */
	protected abstract readonly wrapperClass: string;

	constructor() {
		afterRenderEffect({
			write: () => {
				this.setCSSVariable('--label-width', `${this.labelWidth().toString()}px`);
				this.setCSSVariable('--input-height', `${this.wrapperHeight().toString()}px`);
			},
		});

		effect(() => {
			const label = this.label();
			this.fillLabel(label);
		});
		effect(() => {
			const placeholder = this.placeholder();
			this.fillPlaceholder(placeholder);
		});
	}

	@HostListener('focus')
	onFocus() {
		this.renderer2.addClass(this.wrapperElement, 'focused');
	}

	@HostListener('blur')
	onBlur() {
		this.renderer2.removeClass(this.wrapperElement, 'focused');
	}

	@HostListener('input')
	@HostListener('change')
	onInput() {
		const value = this.elementRef.nativeElement.value;

		if ('' === value) {
			this.renderer2.removeClass(this.wrapperElement, 'filled');
		} else {
			this.renderer2.addClass(this.wrapperElement, 'filled');
		}
	}

	ngOnInit() {
		this.renderer2.addClass(this.wrapperElement, this.wrapperClass);
		this.ensureId();
		this.prepareWrapper();
	}

	ngAfterViewInit() {
		this.observeDisabledChanges();
		this.onInput();
	}

	protected setCSSVariable(name: string, value: string) {
		this.wrapperElement.style.setProperty(name, value);
	}

	/**
	 * `disabled` lives on the native control, but the themed styles hang off the wrapper, so
	 * the attribute is mirrored as a `.disabled` class.
	 */
	private observeDisabledChanges(): void {
		const observer = new MutationObserver(() => {
			this.syncDisabled();
		});

		observer.observe(this.elementRef.nativeElement, {
			attributes: true,
			attributeFilter: ['disabled'],
		});

		this.syncDisabled();

		this.destroyRef.onDestroy(() => {
			observer.disconnect();
		});
	}

	private syncDisabled(): void {
		if (this.elementRef.nativeElement.disabled) {
			this.renderer2.addClass(this.wrapperElement, 'disabled');
		} else {
			this.renderer2.removeClass(this.wrapperElement, 'disabled');
		}
	}

	// Keeps a consumer-provided id, otherwise generates one so the label can point at the
	// control explicitly on top of the implicit wrapping association.
	private ensureId(): void {
		const controlElement = this.elementRef.nativeElement;

		if ('' === controlElement.id) {
			const id = `${this.wrapperClass}-${(nextFieldId++).toString()}`;

			this.renderer2.setAttribute(controlElement, 'id', id);
		}

		this.renderer2.setAttribute(this.labelElement, 'for', controlElement.id);
	}

	private prepareWrapper() {
		const controlElement = this.elementRef.nativeElement;
		const nextSibling = controlElement.nextSibling;
		const parentElement = controlElement.parentNode;

		this.renderer2.addClass(controlElement, 'br-2');

		this.renderer2.removeChild(parentElement, controlElement);
		this.renderer2.appendChild(this.labelElement, controlElement);
		this.renderer2.appendChild(this.wrapperElement, this.labelElement);
		this.renderer2.appendChild(this.wrapperElement, this.borderContainerElement);
		this.renderer2.appendChild(this.wrapperElement, this.fakeLabelElement);

		if (null !== nextSibling) {
			this.renderer2.insertBefore(parentElement, this.wrapperElement, nextSibling);
		} else {
			this.renderer2.appendChild(parentElement, this.wrapperElement);
		}
	}

	private createWrapper(): HTMLDivElement {
		return createTypedElement(this.renderer2, 'div');
	}

	// The measure span lives inside the real label, so it keeps its text while the visible
	// floating label is the sibling `.label` element.
	private createLabel(): HTMLLabelElement {
		const element = createTypedElement(this.renderer2, 'label');
		this.renderer2.appendChild(element, this.labelSpanElement);

		return element;
	}

	private createLabelMeasure(): HTMLSpanElement {
		const element = createTypedElement(this.renderer2, 'span');

		this.renderer2.addClass(element, 'label-measure');

		return element;
	}

	private createFakeLabel(): HTMLSpanElement {
		const element = createTypedElement(this.renderer2, 'p') as HTMLSpanElement;

		this.renderer2.addClass(element, 'label');
		this.renderer2.setAttribute(element, 'aria-hidden', 'true');

		return element;
	}

	private createBorderContainer(): HTMLDivElement {
		const element = createTypedElement(this.renderer2, 'div');

		this.renderer2.addClass(element, 'border-container');
		this.renderer2.addClass(element, 'flex-row');
		this.renderer2.setAttribute(element, 'aria-hidden', 'true');

		return element;
	}

	// The visual label copies are decorative (aria-hidden / visibility:
	// hidden), so the accessible name is set explicitly on the control.
	private fillLabel(value: string): void {
		this.renderer2.setProperty(this.labelSpanElement, 'textContent', value);
		this.renderer2.setProperty(this.fakeLabelElement, 'textContent', value);
		this.renderer2.setAttribute(this.elementRef.nativeElement, 'aria-label', value);
	}

	private fillPlaceholder(value: string): void {
		this.renderer2.setAttribute(this.elementRef.nativeElement, 'placeholder', value);
	}
}
