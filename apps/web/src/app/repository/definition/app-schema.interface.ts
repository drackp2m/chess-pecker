import { ActivitySchema } from '@app/repository/definition/activity-schema.interface';
import { AttemptCursorSchema } from '@app/repository/definition/attempt-cursor-schema.interface';
import {
	AttemptSchema,
	AttemptSchemaV3,
	AttemptSchemaV4,
	AttemptSchemaV5,
} from '@app/repository/definition/attempt-schema.interface';
import { CatalogCursorSchema } from '@app/repository/definition/catalog-cursor-schema.interface';
import { CycleSchema } from '@app/repository/definition/cycle-schema.interface';
import { PuzzleSchema, PuzzleSchemaV10 } from '@app/repository/definition/puzzle-schema.interface';
import { PuzzleSetSchema } from '@app/repository/definition/puzzle-set-schema.interface';
import { SettingSchema } from '@app/repository/definition/setting-schema.interface';
import { TrainingSchema } from '@app/repository/definition/training-schema.interface';

export interface AppSchema
	extends
		ActivitySchema,
		AttemptCursorSchema,
		AttemptSchema,
		CatalogCursorSchema,
		PuzzleSchema,
		PuzzleSetSchema,
		SettingSchema,
		TrainingSchema {}

export interface AppSchemaV10
	extends
		ActivitySchema,
		AttemptSchema,
		CatalogCursorSchema,
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
