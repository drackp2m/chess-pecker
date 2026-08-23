import { signal } from '@angular/core';
import {
	DBSchema,
	IDBPDatabase,
	IDBPTransaction,
	IndexKey,
	IndexNames,
	StoreKey,
	StoreNames,
	StoreValue,
	openDB,
} from 'idb';

import { Repository } from '@app/util/repository';

export type RepositoryTransaction<
	T extends DBSchema,
	M extends IDBTransactionMode,
> = IDBPTransaction<T, StoreNames<T>[], M>;

/**
 * Data access over IndexedDB. A transaction commits as soon as its microtask queue drains,
 * so one cannot be kept in a field: `runInTransaction` is the only way to span operations.
 */
export class GenericRepository<T extends DBSchema> {
	private readonly dbName = 'chess-pecker';
	private readonly blockedUpgrade = signal(false);

	readonly isUpgradeBlocked = this.blockedUpgrade.asReadonly();

	/** Opened on first use and reopened if the browser drops the connection. */
	private database: Promise<IDBPDatabase<T>> | undefined;

	/**
	 * Runs several operations as one unit. The callback may only await database requests, or
	 * the transaction commits early and the next request throws.
	 */
	async runInTransaction<R, M extends 'readonly' | 'readwrite'>(
		storeNames: StoreNames<T>[],
		mode: M,
		operation: (transaction: RepositoryTransaction<T, M>) => Promise<R>,
	): Promise<R> {
		const database = await this.getDatabase();
		const transaction = database.transaction(storeNames, mode);
		let result: R;

		try {
			result = await operation(transaction);
		} catch (error) {
			void transaction.done.catch(() => undefined);
			this.abort(transaction);

			throw error;
		}

		await transaction.done;

		return result;
	}

	async insert<K extends StoreNames<T>>(
		storeName: K,
		value: StoreValue<T, K>,
	): Promise<StoreValue<T, K>> {
		return this.runInTransaction([storeName], 'readwrite', async (transaction) => {
			try {
				await transaction.objectStore(storeName).put(value);
			} catch (error) {
				throw new Error(`Error inserting data in \`${storeName as string}\``, { cause: error });
			}

			return value;
		});
	}

	/** One transaction for the whole batch, so importing many rows stays a single commit. */
	async batchInsert<K extends StoreNames<T>>(
		storeName: K,
		values: StoreValue<T, K>[],
	): Promise<StoreValue<T, K>[]> {
		return this.runInTransaction([storeName], 'readwrite', async (transaction) => {
			const store = transaction.objectStore(storeName);

			try {
				await Promise.all(values.map((value) => store.put(value)));
			} catch (error) {
				throw new Error(
					`Error inserting ${values.length.toString()} rows in \`${storeName as string}\``,
					{ cause: error },
				);
			}

			return values;
		});
	}

	async find<K extends StoreNames<T>>(
		storeName: K,
		key: StoreKey<T, K>,
	): Promise<StoreValue<T, K> | undefined> {
		const value = await this.runInTransaction([storeName], 'readonly', (transaction) =>
			transaction.objectStore(storeName).get(key),
		);

		return undefined === value ? undefined : this.hydrate(storeName, value);
	}

	async findByIndex<K extends StoreNames<T>>(
		storeName: K,
		indexName: IndexNames<T, K>,
		indexValue: IDBKeyRange | IndexKey<T, K, IndexNames<T, K>>,
	): Promise<StoreValue<T, K> | undefined> {
		const value = await this.runInTransaction([storeName], 'readonly', (transaction) =>
			transaction.objectStore(storeName).index(indexName).get(indexValue),
		);

		return undefined === value ? undefined : this.hydrate(storeName, value);
	}

	async findAll<K extends StoreNames<T>>(storeName: K): Promise<StoreValue<T, K>[]> {
		const values = await this.runInTransaction([storeName], 'readonly', (transaction) =>
			transaction.objectStore(storeName).getAll(),
		);

		return values.map((value) => this.hydrate(storeName, value));
	}

	async findAllByIndex<K extends StoreNames<T>>(
		storeName: K,
		indexName: IndexNames<T, K>,
		indexValue: IDBKeyRange | IndexKey<T, K, IndexNames<T, K>>,
	): Promise<StoreValue<T, K>[]> {
		const values = await this.runInTransaction([storeName], 'readonly', (transaction) =>
			transaction.objectStore(storeName).index(indexName).getAll(indexValue),
		);

		return values.map((value) => this.hydrate(storeName, value));
	}

	async delete<K extends StoreNames<T>>(storeName: K, key: StoreKey<T, K>): Promise<void> {
		await this.runInTransaction([storeName], 'readwrite', (transaction) =>
			transaction.objectStore(storeName).delete(key),
		);
	}

	async clear(storeName: StoreNames<T>): Promise<void> {
		await this.runInTransaction([storeName], 'readwrite', (transaction) =>
			transaction.objectStore(storeName).clear(),
		);
	}

	/**
	 * Turns a stored record back into what the caller reads. IndexedDB structured-clones on
	 * write, so a repository holding class instances overrides this to rebuild them.
	 */
	protected hydrate<K extends StoreNames<T>>(
		_storeName: K,
		value: StoreValue<T, K>,
	): StoreValue<T, K> {
		return value;
	}

	private getDatabase(): Promise<IDBPDatabase<T>> {
		const opened = this.database;

		if (undefined !== opened) {
			return opened;
		}

		const connection = this.open().catch((error: unknown) => {
			// A failed open is not cached: a later attempt may well succeed, and leaving
			// a rejected promise in the field would fail every future call with it.
			this.database = undefined;

			throw new Error(`Could not open the \`${this.dbName}\` database`, { cause: error });
		});

		this.database = connection;

		return connection;
	}

	private async open(): Promise<IDBPDatabase<T>> {
		let migrations: Promise<void> | undefined;

		const opening = openDB<T>(this.dbName, Repository.getLatestVersion(), {
			upgrade: (database, oldVersion, newVersion, transaction) => {
				migrations = this.migrate(database, oldVersion, newVersion, transaction);

				void migrations.catch(() => undefined);
			},

			// Another tab still holds an older version open, so the upgrade cannot run.
			blocked: (currentVersion, blockedVersion) => {
				this.blockedUpgrade.set(true);

				console.warn(
					`IndexedDB upgrade from ${currentVersion.toString()} to ${String(blockedVersion)} is blocked by another tab.`,
				);
			},

			// This tab holds the version another one is trying to upgrade past. Letting
			// go unblocks it; this connection reopens on its next use.
			blocking: (_currentVersion, _blockedVersion, event) => {
				(event.target as IDBDatabase | null)?.close();
				this.database = undefined;
			},

			// The browser dropped the connection (storage eviction, a crashed backend).
			terminated: () => {
				this.database = undefined;
			},
		});

		try {
			return await opening;
		} finally {
			this.blockedUpgrade.set(false);

			await migrations;
		}
	}

	private async migrate(
		database: IDBPDatabase<T>,
		oldVersion: number,
		newVersion: number | null,
		transaction: RepositoryTransaction<T, 'versionchange'>,
	): Promise<void> {
		try {
			await Repository.applyMigrations(database, oldVersion, newVersion, transaction);
		} catch (error) {
			void transaction.done.catch(() => undefined);
			this.abort(transaction);

			throw error;
		}
	}

	/** Aborting a transaction that already settled throws; that case is not an error. */
	private abort<M extends IDBTransactionMode>(transaction: RepositoryTransaction<T, M>): void {
		try {
			transaction.abort();
		} catch {
			return;
		}
	}
}
