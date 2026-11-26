import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { Resettable } from '@app/definition/resettable.interface';
import { ShareRow } from '@app/repository/definition/share-schema.interface';
import { PuzzleShareRepository } from '@app/repository/puzzle-share.repository';
import { SessionStore } from '@app/store/session.store';
import { toShareRow } from '@app/use-case/share-mirror.use-case';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { hasAnswered } from '@app/util/challenge-standing';

interface ReceivedShareStoreProps {
	shares: readonly ShareRow[];
	isLoaded: boolean;
	hasFailed: boolean;
}

const initialState: ReceivedShareStoreProps = {
	shares: [],
	isLoaded: false,
	hasFailed: false,
};

@Injectable({
	providedIn: 'root',
})
export class ReceivedShareStore
	extends signalStore({ protectedState: false }, withState(initialState))
	implements Resettable
{
	private readonly repository = inject(PuzzleShareRepository);
	private readonly session = inject(SessionStore);

	private inFlight: Promise<void> | null = null;
	private generation = 0;

	readonly sorted = computed(() =>
		[...this.shares()].sort((one, other) => other.createdAt.getTime() - one.createdAt.getTime()),
	);

	readonly pending = computed(() => {
		const userUuid = this.session.user()?.uuid ?? null;

		return this.sorted().filter((share) => !hasAnswered(share, userUuid));
	});

	find(uuid: string): ShareRow | undefined {
		return this.shares().find((share) => share.uuid === uuid);
	}

	async ensureLoaded(): Promise<void> {
		if (this.isLoaded()) {
			return;
		}

		await this.reload();
	}

	async reload(): Promise<void> {
		await this.refresh();

		if (!this.isLoaded()) {
			await this.refresh();
		}

		if (!this.isLoaded()) {
			throw new Error('Could not load the received challenges');
		}
	}

	async refresh(): Promise<void> {
		this.inFlight ??= this.fetch().finally(() => {
			this.inFlight = null;
		});

		await this.inFlight;
	}

	upsert(row: ShareRow): void {
		const others = this.shares().filter((share) => share.uuid !== row.uuid);

		patchState(this, { shares: [...others, row] });
	}

	reset(): void {
		this.generation++;
		this.inFlight = null;
		patchState(this, initialState);
	}

	private async fetch(): Promise<void> {
		const generation = this.generation;

		patchState(this, { hasFailed: false });

		try {
			const shares = await this.repository.listReceived();

			if (generation === this.generation) {
				patchState(this, { shares: shares.map(toShareRow), isLoaded: true });
			}
		} catch (error: unknown) {
			if (!ApiCancelledError.is(error) && generation === this.generation) {
				console.error('Could not load the received challenges', error);
				patchState(this, { hasFailed: true });
			}
		}
	}
}
