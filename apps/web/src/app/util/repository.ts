import { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';

import {
	AppSchema,
	AppSchemaV10,
	AppSchemaV14,
	AppSchemaV16,
	AppSchemaV17,
	AppSchemaV3,
	AppSchemaV4,
	AppSchemaV5,
} from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';
import { SettingSchemaV1 } from '@app/repository/definition/setting-schema.interface';
import { createCatalogCursorStoreMigration } from '@app/repository/migration/v10_create-catalog-cursor-store.migration';
import { createLocalTrainingStoresMigration } from '@app/repository/migration/v11_create-training-stores.migration';
import { dropAttemptOrientationMigration } from '@app/repository/migration/v12_drop-attempt-orientation.migration';
import { createAttemptCursorStoreMigration } from '@app/repository/migration/v13_create-attempt-cursor-store.migration';
import { resetAttemptCursorMigration } from '@app/repository/migration/v14_reset-attempt-cursor.migration';
import { splitAttemptDraftMigration } from '@app/repository/migration/v15_split-attempt-draft.migration';
import { markLocalRowsPendingMigration } from '@app/repository/migration/v16_mark-local-rows-pending.migration';
import { unifySyncCursorsMigration } from '@app/repository/migration/v17_unify-sync-cursors.migration';
import { renameActivityVerdictsMigration } from '@app/repository/migration/v18_rename-activity-verdicts.migration';
import { renameFreePlayRunsMigration } from '@app/repository/migration/v19_rename-free-play-runs.migration';
import { createSettingStoreMigration } from '@app/repository/migration/v1_create-setting-store.migration';
import { indexRejectedRowsMigration } from '@app/repository/migration/v20_index-rejected-rows.migration';
import { createBookmarkStoreMigration } from '@app/repository/migration/v21_create-bookmark-store.migration';
import { createShareStoreMigration } from '@app/repository/migration/v22_create-share-store.migration';
import { indexAttemptUpdatedAtMigration } from '@app/repository/migration/v23_index-attempt-updated-at.migration';
import { dropActivityStoreMigration } from '@app/repository/migration/v24_drop-activity-store.migration';
import { rekeySettingStoreMigration } from '@app/repository/migration/v2_rekey-setting-store.migration';
import { createTrainingStoresMigration } from '@app/repository/migration/v3_create-training-stores.migration';
import { rekeyAttemptStoreMigration } from '@app/repository/migration/v4_rekey-attempt-store.migration';
import { recordAttemptSolveMigration } from '@app/repository/migration/v5_record-attempt-solve.migration';
import { recordAttemptClosureMigration } from '@app/repository/migration/v6_record-attempt-closure.migration';
import { createActivityStoreMigration } from '@app/repository/migration/v7_create-activity-store.migration';
import { createActivityCursorStoreMigration } from '@app/repository/migration/v8_create-activity-cursor-store.migration';
import { markStoredAttemptsSyncedMigration } from '@app/repository/migration/v9_mark-stored-attempts-synced.migration';

export abstract class Repository {
	private static migrations: (
		| Migration<AppSchema>
		| Migration<AppSchemaV10>
		| Migration<AppSchemaV14>
		| Migration<AppSchemaV16>
		| Migration<AppSchemaV17>
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
		createActivityStoreMigration,
		createActivityCursorStoreMigration,
		markStoredAttemptsSyncedMigration,
		createCatalogCursorStoreMigration,
		createLocalTrainingStoresMigration,
		dropAttemptOrientationMigration,
		createAttemptCursorStoreMigration,
		resetAttemptCursorMigration,
		splitAttemptDraftMigration,
		markLocalRowsPendingMigration,
		unifySyncCursorsMigration,
		renameActivityVerdictsMigration,
		renameFreePlayRunsMigration,
		indexRejectedRowsMigration,
		createBookmarkStoreMigration,
		createShareStoreMigration,
		indexAttemptUpdatedAtMigration,
		dropActivityStoreMigration,
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
		const pending = migrations.filter((migration) => migration.version > oldVersion);

		if (0 < pending.length && 'undefined' !== typeof APP_DEBUG && APP_DEBUG) {
			const target = newVersion ?? oldVersion;
			const versions = pending.map((migration) => migration.version.toString()).join(', ');

			console.log(`IndexedDB v${oldVersion.toString()} → v${target.toString()}: ${versions}`);
		}

		for (const migration of pending) {
			await applyMigration(migration, { database, oldVersion, newVersion, transaction });
		}
	}
}

async function applyMigration<T>(
	migration: Migration<T>,
	context: Parameters<Migration<T>['apply']>[0],
): Promise<void> {
	try {
		await migration.apply(context);
	} catch (error) {
		throw new Error(
			`IndexedDB migration v${migration.version.toString()} failed: ${migration.description}`,
			{ cause: error },
		);
	}
}
