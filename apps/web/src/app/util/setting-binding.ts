import { Signal, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

interface SettingControl<T> {
	readonly valueChanges: Observable<unknown>;
	getRawValue(): T;
	setValue(value: T, options: { emitEvent: boolean }): void;
}

/**
 * Two-way link between a form control and a persisted signal. The stored value arrives after
 * the form is built, and that mirroring is the first change the control emits.
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
