import { IsBoolean, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

import { SyncTimestampsDto } from './sync-timestamps.dto';

export class SubmitCycleAttemptRequestDto extends SyncTimestampsDto {
	/** El ejercicio sale del item, que ya dice cuál toca y en qué posición del ciclo. */
	@IsString()
	@IsNotEmpty()
	cycleItemUuid!: string;

	@IsInt()
	@Min(0)
	durationMs!: number;

	@IsBoolean()
	solved!: boolean;
}
