import {
	AttemptSchema,
	AttemptSchemaV3,
	AttemptSchemaV4,
	AttemptSchemaV5,
} from '@app/repository/definition/attempt-schema.interface';
import { CycleSchema } from '@app/repository/definition/cycle-schema.interface';
import { PuzzleSchema } from '@app/repository/definition/puzzle-schema.interface';
import { PuzzleSetSchema } from '@app/repository/definition/puzzle-set-schema.interface';
import { SettingSchema } from '@app/repository/definition/setting-schema.interface';

export interface AppSchema
	extends AttemptSchema, CycleSchema, PuzzleSchema, PuzzleSetSchema, SettingSchema {}

export interface AppSchemaV5
	extends AttemptSchemaV5, CycleSchema, PuzzleSchema, PuzzleSetSchema, SettingSchema {}

export interface AppSchemaV4
	extends AttemptSchemaV4, CycleSchema, PuzzleSchema, PuzzleSetSchema, SettingSchema {}

export interface AppSchemaV3
	extends AttemptSchemaV3, CycleSchema, PuzzleSchema, PuzzleSetSchema, SettingSchema {}
