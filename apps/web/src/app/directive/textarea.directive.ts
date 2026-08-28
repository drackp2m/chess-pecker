import {
	DestroyRef,
	Directive,
	HostListener,
	afterRenderEffect,
	booleanAttribute,
	inject,
	input,
	numberAttribute,
} from '@angular/core';

import { ThemedFieldDirective } from '@app/directive/field/themed-field.directive';

export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both';

interface TextareaMetrics {
	readonly lineHeight: number;
	readonly verticalPadding: number;
}

interface TextareaLayout {
	readonly rows: number;
	readonly maxRows: number;
	readonly resize: TextareaResize;
}

const SETTLE_DELAY = 120;

/**
 * The themed input's shell around a `<textarea>`: same floating label and notched border,
 * plus the sizing a multi-line control needs — how many lines it opens at, whether it
 * follows what is typed, where it stops growing and which axes can be dragged.
 */
@Directive({
	selector: 'textarea[appThemed]',
})
export class TextareaDirective extends ThemedFieldDirective<HTMLTextAreaElement> {
	readonly rows = input(3, { transform: numberAttribute });
	/** `0` leaves it uncapped, so it grows — or is dragged — as far as its container allows. */
	readonly maxRows = input(0, { transform: numberAttribute });
	readonly autoGrow = input(false, { transform: booleanAttribute });
	readonly resize = input<TextareaResize>('none');
	readonly snapLines = input(true, { transform: booleanAttribute });

	protected readonly wrapperClass = 'app-textarea';

	private readonly ownDestroyRef = inject(DestroyRef);

	private appliedHeight = '';
	private observedWidth = 0;
	private userResized = false;
	private settleHeightTimeout?: ReturnType<typeof setTimeout>;
	private settleScrollTimeout?: ReturnType<typeof setTimeout>;

	constructor() {
		super();

		afterRenderEffect({
			earlyRead: () => {
				// The line height only settles once the web font has, and the wrapper's own
				// height is what moves when it does.
				this.wrapperHeight();

				return {
					rows: this.rows(),
					maxRows: this.maxRows(),
					resize: this.resize(),
				};
			},
			write: (layout) => {
				this.applyLayout(layout());
			},
		});

		this.observeDrag();

		this.ownDestroyRef.onDestroy(() => {
			clearTimeout(this.settleHeightTimeout);
			clearTimeout(this.settleScrollTimeout);
		});
	}

	@HostListener('scroll')
	onScroll(): void {
		if (!this.snapLines()) {
			return;
		}

		clearTimeout(this.settleScrollTimeout);

		this.settleScrollTimeout = setTimeout(() => {
			this.snapScroll();
		}, SETTLE_DELAY);
	}

	override onInput(): void {
		super.onInput();
		this.grow();
	}

	private applyLayout(layout: TextareaLayout): void {
		const textarea = this.elementRef.nativeElement;

		if (textarea.rows !== layout.rows) {
			this.renderer2.setAttribute(textarea, 'rows', layout.rows.toString());
		}

		this.applyBounds(layout);
		this.applyResize(layout.resize);
		this.grow();
	}

	private applyBounds(layout: TextareaLayout): void {
		const textarea = this.elementRef.nativeElement;

		if (0 < layout.maxRows) {
			const maxHeight = `calc(${layout.maxRows.toString()} * 1lh + var(--block-padding))`;

			this.renderer2.setStyle(textarea, 'max-height', maxHeight);
		} else {
			this.renderer2.removeStyle(textarea, 'max-height');
		}

		if (dragsHeight(layout.resize)) {
			this.renderer2.setStyle(textarea, 'min-height', 'calc(1lh + var(--block-padding))');
		} else {
			this.renderer2.removeStyle(textarea, 'min-height');
		}
	}

	private applyResize(resize: TextareaResize): void {
		this.renderer2.setStyle(this.elementRef.nativeElement, 'resize', resize);

		if (!dragsHeight(resize)) {
			this.userResized = false;
		}

		if (dragsWidth(resize)) {
			this.renderer2.addClass(this.wrapperElement, 'resize-x');
		} else {
			this.renderer2.removeClass(this.wrapperElement, 'resize-x');
			this.renderer2.removeClass(this.wrapperElement, 'resized-x');
		}
	}

	private observeDrag(): void {
		const textarea = this.elementRef.nativeElement;
		const observer = new ResizeObserver(() => {
			this.onObservedResize();
		});

		observer.observe(textarea);

		this.ownDestroyRef.onDestroy(() => {
			observer.disconnect();
		});
	}

	private onObservedResize(): void {
		const textarea = this.elementRef.nativeElement;
		const resize = this.resize();

		if (dragsWidth(resize) && '' !== textarea.style.width) {
			this.renderer2.addClass(this.wrapperElement, 'resized-x');
		}

		if (dragsHeight(resize) && textarea.style.height !== this.appliedHeight) {
			this.onHeightDragged();
		} else if (textarea.offsetWidth !== this.observedWidth) {
			this.observedWidth = textarea.offsetWidth;
			this.grow();
		}
	}

	private onHeightDragged(): void {
		this.appliedHeight = this.elementRef.nativeElement.style.height;
		this.userResized = true;
		this.renderer2.setStyle(this.elementRef.nativeElement, 'overflow-y', 'auto');

		if (!this.snapLines()) {
			return;
		}

		clearTimeout(this.settleHeightTimeout);

		this.settleHeightTimeout = setTimeout(() => {
			this.snapHeight();
		}, SETTLE_DELAY);
	}

	private snapHeight(): void {
		const textarea = this.elementRef.nativeElement;
		const { lineHeight, verticalPadding } = this.readMetrics();
		const rows = Math.max(1, Math.round((textarea.offsetHeight - verticalPadding) / lineHeight));
		const height = rows * lineHeight + verticalPadding;

		this.setHeight(`${height.toString()}px`);
		this.snapScroll();
	}

	private snapScroll(): void {
		const textarea = this.elementRef.nativeElement;
		const { lineHeight } = this.readMetrics();
		const maxScroll = textarea.scrollHeight - textarea.clientHeight;
		const top = Math.min(Math.round(textarea.scrollTop / lineHeight) * lineHeight, maxScroll);

		if (0.5 > Math.abs(top - textarea.scrollTop)) {
			return;
		}

		textarea.scrollTo({ top, behavior: 'smooth' });
	}

	/** Follows the text while it is typed, between the opening rows and the capped ones. */
	private grow(): void {
		if (!this.autoGrow() || this.userResized) {
			return;
		}

		const textarea = this.elementRef.nativeElement;
		const { lineHeight, verticalPadding } = this.readMetrics();
		const maxRows = this.maxRows();
		const minHeight = this.rows() * lineHeight + verticalPadding;
		const maxHeight = maxRows * lineHeight + verticalPadding;

		this.setHeight('auto');

		const contentHeight = Math.max(textarea.scrollHeight, minHeight);
		const height = 0 < maxRows ? Math.min(contentHeight, maxHeight) : contentHeight;

		this.setHeight(`${height.toString()}px`);
		this.renderer2.setStyle(textarea, 'overflow-y', height < contentHeight ? 'auto' : 'hidden');
	}

	private setHeight(value: string): void {
		this.renderer2.setStyle(this.elementRef.nativeElement, 'height', value);
		this.appliedHeight = this.elementRef.nativeElement.style.height;
	}

	private readMetrics(): TextareaMetrics {
		const style = getComputedStyle(this.elementRef.nativeElement);
		const lineHeight = toPixels(style.lineHeight);

		return {
			lineHeight: 0 === lineHeight ? 1.5 * toPixels(style.fontSize) : lineHeight,
			verticalPadding: toPixels(style.paddingTop) + toPixels(style.paddingBottom),
		};
	}
}

function dragsHeight(resize: TextareaResize): boolean {
	return 'vertical' === resize || 'both' === resize;
}

function dragsWidth(resize: TextareaResize): boolean {
	return 'horizontal' === resize || 'both' === resize;
}

/** A computed length is always in pixels, except when it is `normal` or the box has no layout. */
function toPixels(value: string): number {
	const parsed = Number.parseFloat(value);

	return Number.isNaN(parsed) ? 0 : parsed;
}
