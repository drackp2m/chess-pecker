import { DestroyRef, Injectable, Injector, effect, inject, signal } from '@angular/core';

import { MatchStore } from '@app/page/match/store/match.store';
import { MatchRepository } from '@app/repository/match.repository';

@Injectable()
export class MatchPersistenceService {
	private readonly repository = inject(MatchRepository);

	private readonly store = inject(MatchStore);

	private readonly injector = inject(Injector);

	private readonly restored = signal(false);

	private isDestroyed = false;

	readonly isRestored = this.restored.asReadonly();

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.isDestroyed = true;
		});
	}

	async open(): Promise<void> {
		const row = await this.repository.read().catch(() => undefined);

		if (this.isDestroyed) {
			return;
		}

		if (undefined !== row) {
			this.store.restore(row);
		}

		this.restored.set(true);
		effect(
			() => {
				void this.repository.save(this.store.snapshot()).catch(() => undefined);
			},
			{ injector: this.injector },
		);
	}
}
