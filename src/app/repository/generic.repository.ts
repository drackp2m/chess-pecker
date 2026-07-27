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

interface RepositoryTransactionOptions {
	waitForExisting?: boolean;
	timeout?: number;
}

export class GenericRepository<T extends DBSchema> {
	private dbName = 'chess-pecker';
	private dbPromise = this.getDbPromise();
	private transaction: IDBPTransaction<T, StoreNames<T>[], 'readwrite' | 'readonly'> | null = null;

	constructor() {
		window.addEventListener('beforeunload', () => {
			if (null !== this.transaction) {
				console.warn('Uncompleted transaction detected');
				this.transaction.abort();
			}
		});
	}

	async beginTransaction(
		storeNames: StoreNames<T>[],
		options: RepositoryTransactionOptions = {},
	): Promise<void> {
		const { waitForExisting = true, timeout = 5000 } = options;

		if (null !== this.transaction) {
			const currentStores = Array.from(this.transaction.objectStoreNames);
			const missingStores = storeNames.filter((store) => !currentStores.includes(store));

			if (0 === missingStores.length) {
				return;
			}

			if (waitForExisting) {
				const result = await this.waitForTransactionWithTimeout(timeout);

				if (!result.success) {
					return Promise.reject(new Error(result.error ?? ''));
				}
			} else {
				console.warn(
					'Cannot start new transaction with stores:',
					missingStores.join(', '),
					'Active transaction will be used instead.',
				);

				return;
			}
		}

		const db = await this.dbPromise;
		this.transaction = db.transaction(storeNames, 'readwrite');
		this.setupTransactionListeners();
	}

	// FixMe => transactions will be committes without calling this method
	//
	// The cause is IndexedDB's own rule, not a bug in the bookkeeping: a transaction
	// auto-commits as soon as its microtask queue drains, so one held across an
	// `await` that is not itself an IDB request is already closed by the time the next
	// call reaches it — hence `TransactionInactiveError` rather than a clean commit.
	// `beginTransaction`/`commitTransaction` cannot be made to work as written.
	// The shape that does: `withTransaction(stores, mode, (tx) => …)` doing all its
	// work inside one callback, with no public begin/commit at all. `batchInsert` is
	// then a single `Promise.all` of `tx.objectStore(...).put(...)`, which is also
	// what makes importing thousands of puzzle rows fast instead of one tx per row.
	async commitTransaction(): Promise<void> {
		if (null !== this.transaction) {
			const tx = this.transaction;
			this.transaction = null;
			await tx.done;
		}
	}

	async insert<K extends StoreNames<T>>(
		storeName: K,
		value: StoreValue<T, K>,
	): Promise<StoreValue<T, K>> {
		return this.withTransaction([storeName], 'readwrite', async (tx) => {
			try {
				await tx.objectStore(storeName).put(value);

				return value;
			} catch (error) {
				tx.abort();

				return Promise.reject(
					new Error(
						`Error inserting data in \`${storeName as string}\`: ${JSON.stringify(value)}\n${(error as Error).message}`,
					),
				);
			}
		});
	}

	async batchInsert<K extends StoreNames<T>>(
		storeName: K,
		values: StoreValue<T, K>[],
		transactionOptions: RepositoryTransactionOptions = { waitForExisting: false },
	): Promise<StoreValue<T, K>[]> {
		const hasExistingValidTransaction =
			null !== this.transaction &&
			Array.from(this.transaction.objectStoreNames).includes(storeName);

		if (!hasExistingValidTransaction) {
			await this.beginTransaction([storeName], transactionOptions);
		}

		const results = await Promise.all(values.map((value) => this.insert(storeName, value))).catch(
			(error: unknown) => {
				this.transaction?.abort();

				return Promise.reject(new Error(`Batch insert failed: ${(error as Error).message}`));
			},
		);

		if (!hasExistingValidTransaction) {
			await this.commitTransaction();
		}

		return results;
	}

	// ToDo => try transform plain data to model
	//
	// Worth doing here rather than per-repository: `SettingRepository` only overrides
	// `findAll`, so `find`, `findByIndex` and `findAllByIndex` hand back the raw
	// structured-clone output typed as `Setting` — plain objects with no `.with()`.
	// Nothing reads settings through those three today, so the lie is invisible; it
	// stops being invisible the moment puzzles and attempts are read by index.
	// A `hydrate` hook on the class (identity by default) would cover every read path.
	async find<K extends StoreNames<T>>(
		storeName: K,
		key: StoreKey<T, K>,
	): Promise<StoreValue<T, K> | undefined> {
		return this.withTransaction([storeName], 'readonly', async (tx) => {
			return tx.objectStore(storeName).get(key);
		});
	}

	async findByIndex<K extends StoreNames<T>>(
		storeName: K,
		indexName: IndexNames<T, K>,
		indexValue: IDBKeyRange | IndexKey<T, K, IndexNames<T, K>>,
	): Promise<StoreValue<T, K> | undefined> {
		return this.withTransaction([storeName], 'readonly', (tx) => {
			return tx.objectStore(storeName).index(indexName).get(indexValue);
		});
	}

	async findAll<K extends StoreNames<T>>(storeName: K): Promise<StoreValue<T, K>[]> {
		return this.withTransaction([storeName], 'readonly', async (tx) => {
			return tx.objectStore(storeName).getAll();
		});
	}

	async findAllByIndex<K extends StoreNames<T>>(
		storeName: K,
		indexName: IndexNames<T, K>,
		indexValue: IDBKeyRange | IndexKey<T, K, IndexNames<T, K>>,
	): Promise<StoreValue<T, K>[]> {
		return this.withTransaction([storeName], 'readonly', async (tx) => {
			return tx.objectStore(storeName).index(indexName).getAll(indexValue);
		});
	}

	// FixMe => the key parameter is typed `StoreValue` (the whole record) where it
	// should be `StoreKey`. `IDBObjectStore.delete` takes a key, so passing the record
	// the type asks for deletes nothing, and passing the key that actually works is a
	// type error. Nothing calls it yet, which is the only reason it has not bitten.
	async delete<K extends StoreNames<T>>(storeName: K, key: StoreValue<T, K>): Promise<void> {
		await this.withTransaction([storeName], 'readwrite', async (tx) => {
			await tx.objectStore(storeName).delete(key);
		});
	}

	async clear(storeName: StoreNames<T>): Promise<void> {
		await this.withTransaction([storeName], 'readwrite', async (tx) => {
			await tx.objectStore(storeName).clear();
		});
	}

	// FixMe => the ambient transaction is reused without checking that it covers
	// `storeNames`, and the cast launders a `readonly` request into whatever mode the
	// open transaction has. With a single store the mismatch cannot happen; with
	// puzzle/attempt stores added, a read against store B while a transaction on store
	// A is open throws `NotFoundError` from inside an unrelated call. Reuse should be
	// conditional on the open transaction actually containing every requested store.
	private async withTransaction<R, M extends 'readonly' | 'readwrite'>(
		storeNames: StoreNames<T>[],
		mode: M,
		operation: (tx: IDBPTransaction<T, StoreNames<T>[], M>) => Promise<R>,
	): Promise<R> {
		if (null !== this.transaction) {
			return operation(this.transaction as IDBPTransaction<T, StoreNames<T>[], M>);
		}

		const tx = (await this.dbPromise).transaction(storeNames, mode);
		const result = await operation(tx);
		await tx.done;

		return result;
	}

	// FixMe => no failure path and no multi-tab handling. `openDB` rejects on a denied
	// quota or a corrupt database and the rejection propagates to every caller as an
	// unhandled one, with no user-visible error. It also needs the three handlers idb
	// offers, which matter as soon as there is a second store to migrate: `blocked`
	// (another tab holds the old version — tell the user to close it), `blocking`
	// (this tab is holding a newer version back — close the connection), and
	// `terminated` (the browser dropped the connection; reopen it).
	//
	// ToDo => the promise is created at field initialisation, so constructing the
	// repository opens the database. Making it lazy keeps a page that never touches
	// storage from paying for it.
	private getDbPromise(): Promise<IDBPDatabase<T>> {
		return openDB<T>(this.dbName, Repository.getLatestVersion(), {
			upgrade: (db, oldVersion, newVersion, transaction) => {
				Repository.applyMigrations(db, oldVersion, newVersion, transaction);
			},
		});
	}

	private async waitForTransactionWithTimeout(timeout: number): Promise<{
		success: boolean;
		error?: string;
	}> {
		if (null === this.transaction) {
			return { success: true };
		}

		return Promise.race([
			this.transaction.done.then(() => ({ success: true })),
			new Promise<{ success: false; error: string }>((resolve) => {
				setTimeout(() => {
					this.transaction?.abort();
					this.transaction = null;
					resolve({
						success: false,
						error: `Transaction wait timeout after ${timeout.toString()}ms`,
					});
				}, timeout);
			}),
		]);
	}

	// ToDo => these three `console.log`s run in production on every write. Route them
	// through `Debug.log` (already gated on the `APP_DEBUG` build constant) or drop them.
	private setupTransactionListeners(): void {
		if (null === this.transaction) {
			return;
		}

		this.transaction.addEventListener('complete', () => {
			console.log('Transaction completed');
			this.transaction = null;
		});

		this.transaction.addEventListener('abort', () => {
			console.log('Transaction aborted');
			this.transaction = null;
		});

		this.transaction.addEventListener('error', (event) => {
			console.error('Transaction error:', event);
			this.transaction?.abort();
			this.transaction = null;
		});
	}
}
