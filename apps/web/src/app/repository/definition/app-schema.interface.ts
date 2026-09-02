import {
	ActivityCursorSchemaV16,
	ActivitySchema,
} from '@app/repository/definition/activity-schema.interface';
import { AttemptCursorSchema } from '@app/repository/definition/attempt-cursor-schema.interface';
import { AttemptDraftSchema } from '@app/repository/definition/attempt-draft-schema.interface';
import {
	AttemptSchema,
	AttemptSchemaV14,
	AttemptSchemaV3,
	AttemptSchemaV4,
	AttemptSchemaV5,
} from '@app/repository/definition/attempt-schema.interface';
import { BookmarkSchema } from '@app/repository/definition/bookmark-schema.interface';
import { CatalogCursorSchemaV16 } from '@app/repository/definition/catalog-cursor-schema.interface';
import { CycleSchema } from '@app/repository/definition/cycle-schema.interface';
import { PuzzleSchema, PuzzleSchemaV10 } from '@app/repository/definition/puzzle-schema.interface';
import { PuzzleSetSchema } from '@app/repository/definition/puzzle-set-schema.interface';
import { SettingSchema } from '@app/repository/definition/setting-schema.interface';
import { ShareSchema } from '@app/repository/definition/share-schema.interface';
import {
	SyncCursorSchema,
	SyncCursorSchemaV17,
} from '@app/repository/definition/sync-cursor-schema.interface';
import { TrainingSchema } from '@app/repository/definition/training-schema.interface';

export interface AppSchema
	extends
		AttemptCursorSchema,
		AttemptDraftSchema,
		AttemptSchema,
		BookmarkSchema,
		PuzzleSchema,
		PuzzleSetSchema,
		SettingSchema,
		ShareSchema,
		SyncCursorSchema,
		TrainingSchema {}

export interface AppSchemaV17 extends ActivitySchema, SyncCursorSchemaV17 {}

export interface AppSchemaV16
	extends
		ActivityCursorSchemaV16,
		ActivitySchema,
		AttemptCursorSchema,
		AttemptDraftSchema,
		AttemptSchema,
		CatalogCursorSchemaV16,
		PuzzleSchema,
		PuzzleSetSchema,
		SettingSchema,
		TrainingSchema {}

export interface AppSchemaV14
	extends
		ActivityCursorSchemaV16,
		ActivitySchema,
		AttemptCursorSchema,
		AttemptSchemaV14,
		CatalogCursorSchemaV16,
		PuzzleSchema,
		PuzzleSetSchema,
		SettingSchema,
		TrainingSchema {}

export interface AppSchemaV10
	extends
		ActivityCursorSchemaV16,
		ActivitySchema,
		AttemptSchemaV14,
		CatalogCursorSchemaV16,
		CycleSchema,
		PuzzleSchemaV10,
		PuzzleSetSchema,
		SettingSchema {}

export interface AppSchemaV5
	extends AttemptSchemaV5, CycleSchema, PuzzleSchemaV10, PuzzleSetSchema, SettingSchema {}

export interface AppSchemaV4
	extends AttemptSchemaV4, CycleSchema, PuzzleSchemaV10, PuzzleSetSchema, SettingSchema {}

export interface AppSchemaV3
	extends AttemptSchemaV3, CycleSchema, PuzzleSchemaV10, PuzzleSetSchema, SettingSchema {}
