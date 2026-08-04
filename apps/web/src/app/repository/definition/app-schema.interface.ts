import { AttemptSchema } from '@app/repository/definition/attempt-schema.interface';
import { CycleSchema } from '@app/repository/definition/cycle-schema.interface';
import { PuzzleSchema } from '@app/repository/definition/puzzle-schema.interface';
import { PuzzleSetSchema } from '@app/repository/definition/puzzle-set-schema.interface';
import { SettingSchema } from '@app/repository/definition/setting-schema.interface';

export interface AppSchema
	extends AttemptSchema, CycleSchema, PuzzleSchema, PuzzleSetSchema, SettingSchema {}
