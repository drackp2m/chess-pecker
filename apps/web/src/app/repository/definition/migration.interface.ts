import { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';

export interface Migration<T> {
	version: number;
	description: string;
	apply: (props: {
		database: IDBPDatabase<T>;
		oldVersion: number;
		newVersion: number | null;
		transaction: IDBPTransaction<T, StoreNames<T>[], 'versionchange'>;
	}) => void;
}
