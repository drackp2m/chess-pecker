import type { Signal } from '@angular/core';

import type { TranslationRef } from '@app/definition/i18n.type';
import { Resettable } from '@app/definition/resettable.interface';

export interface Syncable extends Resettable {
	readonly isLoading: Signal<boolean>;
	readonly isSubmitting: Signal<boolean>;
	readonly isSyncing: Signal<boolean>;
	readonly pending: Signal<number>;
	readonly lastSyncedAt: Signal<Date | null>;
	readonly error: Signal<TranslationRef | null>;
	whenReady(): Promise<void>;
}
