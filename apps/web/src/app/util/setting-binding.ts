import { Signal, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

interface SettingControl<T> {
	readonly valueChanges: Observable<unknown>;
	getRawValue(): T;
	setValue(value: T, options: { emitEvent: boolean }): void;
}

/**
 * Two-way link between a form control and the signal a service persists. The stored
 * value arrives after the form is built, so it is mirrored back in — and that mirroring
 * is itself the first change the control emits, which is why it never writes back.
 */
export function bindSetting<T>(
	control: SettingControl<T>,
	source: Signal<T>,
	write: (value: T) => void,
): void {
	effect(() => {
		control.setValue(source(), { emitEvent: false });
	});

	const changes = toSignal(control.valueChanges, { initialValue: undefined });

	let isFirstChangeIgnored = false;

	effect(() => {
		changes();

		if (isFirstChangeIgnored) {
			write(control.getRawValue());
		} else {
			isFirstChangeIgnored = true;
		}
	});
}
