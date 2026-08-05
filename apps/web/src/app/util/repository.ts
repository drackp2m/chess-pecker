import { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';

import {
	AppSchema,
	AppSchemaV3,
	AppSchemaV4,
	AppSchemaV5,
} from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';
import { SettingSchemaV1 } from '@app/repository/definition/setting-schema.interface';
import { createSettingStoreMigration } from '@app/repository/migration/v1_create-setting-store.migration';
import { rekeySettingStoreMigration } from '@app/repository/migration/v2_rekey-setting-store.migration';
import { createTrainingStoresMigration } from '@app/repository/migration/v3_create-training-stores.migration';
import { rekeyAttemptStoreMigration } from '@app/repository/migration/v4_rekey-attempt-store.migration';
import { recordAttemptSolveMigration } from '@app/repository/migration/v5_record-attempt-solve.migration';
import { recordAttemptClosureMigration } from '@app/repository/migration/v6_record-attempt-closure.migration';

export abstract class Repository {
	private static migrations: (
		| Migration<AppSchema>
		| Migration<AppSchemaV3>
		| Migration<AppSchemaV4>
		| Migration<AppSchemaV5>
		| Migration<SettingSchemaV1>
	)[] = [
		createSettingStoreMigration,
		rekeySettingStoreMigration,
		createTrainingStoresMigration,
		rekeyAttemptStoreMigration,
		recordAttemptSolveMigration,
		recordAttemptClosureMigration,
	];

	static getLatestVersion(): number {
		if (0 === this.migrations.length) {
			throw new Error('No migrations found');
		}

		const versions = this.migrations.map((migration) => migration.version);
		const maxVersion =
			Math.max(...versions) > versions.length ? Math.max(...versions) : versions.length;
		const expectedVersions = Array.from({ length: maxVersion }, (_element, index) => index + 1);

		const missingVersions = expectedVersions.filter((version) => !versions.includes(version));

		if (0 < missingVersions.length) {
			throw new Error(
				`Missing migrations for versions [${missingVersions.join(', ')}]. Please make sure that all versions are covered.`,
			);
		}

		return maxVersion;
	}

	static async applyMigrations<T>(
		database: IDBPDatabase<T>,
		oldVersion: number,
		newVersion: number | null,
		transaction: IDBPTransaction<T, StoreNames<T>[], 'versionchange'>,
	): Promise<void> {
		const migrations = this.migrations as unknown as Migration<T>[];

		console.log('Applying IndexedDB migrations:');

		for (const migration of migrations) {
			if (migration.version > oldVersion) {
				console.log(
					`Updating to version ${migration.version.toString()}: ${migration.description}...`,
				);

				await migration.apply({ database, oldVersion, newVersion, transaction });
			}
		}
	}
}
