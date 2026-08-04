import type { ImportPuzzleItem, ImportPuzzleRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayNotEmpty,
	IsArray,
	IsInt,
	IsNotEmpty,
	IsString,
	Min,
	ValidateNested,
} from 'class-validator';

export class ImportPuzzleItemDto implements ImportPuzzleItem {
	@IsString()
	@IsNotEmpty()
	lichessId!: string;

	@IsString()
	@IsNotEmpty()
	fen!: string;

	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	moves!: string[];

	@IsInt()
	@Min(0)
	rating!: number;

	@IsArray()
	@IsString({ each: true })
	themes!: string[];
}

export class ImportPuzzleRequestDto implements ImportPuzzleRequest {
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(5000)
	@ValidateNested({ each: true })
	@Type(() => ImportPuzzleItemDto)
	puzzles!: ImportPuzzleItemDto[];
}
