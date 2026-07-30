import {
	SerializedBase,
	SerializedUpdatable,
} from '@app/definition/use-case/backup-file.interface';

/**
 * Shared (de)serialization for backup/restore: `Date` fields don't survive
 * a JSON round-trip, so every model going into or coming out of a backup
 * file needs its `createdAt`/`updatedAt` converted to/from ISO strings.
 */
export abstract class BackupSerializer {
	static serializeUpdatable<T extends { createdAt: Date; updatedAt: Date }>(
		model: T,
	): SerializedUpdatable<T> {
		return {
			...model,
			createdAt: model.createdAt.toISOString(),
			updatedAt: model.updatedAt.toISOString(),
		};
	}

	static serializeBase<T extends { createdAt: Date }>(model: T): SerializedBase<T> {
		return { ...model, createdAt: model.createdAt.toISOString() };
	}

	static deserializeUpdatable<T>(raw: SerializedUpdatable<T>): T {
		return {
			...raw,
			createdAt: new Date(raw.createdAt),
			updatedAt: new Date(raw.updatedAt),
		} as T;
	}

	static deserializeBase<T>(raw: SerializedBase<T>): T {
		return { ...raw, createdAt: new Date(raw.createdAt) } as T;
	}
}
