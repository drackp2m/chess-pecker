import { Setting } from '@app/model/setting.model';

/** Strips class methods, keeping only the plain data fields of `T`. */
type DataOnly<T> = Pick<
	T,
	{ [K in keyof T]: T[K] extends (...args: never[]) => unknown ? never : K }[keyof T]
>;

export type SerializedUpdatable<T> = Omit<DataOnly<T>, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

export type SerializedBase<T> = Omit<DataOnly<T>, 'createdAt'> & {
	createdAt: string;
};

export interface BackupFile {
	version: number;
	exportedAt: string;
	settings: SerializedUpdatable<Setting>[] | undefined;
}
