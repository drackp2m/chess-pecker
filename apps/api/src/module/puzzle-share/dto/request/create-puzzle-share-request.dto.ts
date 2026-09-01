import type { CreatePuzzleShareRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayNotEmpty,
	IsArray,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { PuzzleShareResultRequestDto } from './puzzle-share-result-request.dto';

/** Enough for anybody's friend list, and a ceiling on what one call can fan out to. */
const MAX_RECIPIENTS = 25;
const MAX_MESSAGE_LENGTH = 500;

export class CreatePuzzleShareRequestDto implements CreatePuzzleShareRequest {
	@IsString()
	@IsNotEmpty()
	lichessId!: string;

	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(MAX_RECIPIENTS)
	@IsUUID(undefined, { each: true })
	recipientUuids!: string[];

	@IsOptional()
	@IsString()
	@MaxLength(MAX_MESSAGE_LENGTH)
	message?: string;

	@IsOptional()
	@IsUUID()
	attemptUuid?: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => PuzzleShareResultRequestDto)
	result?: PuzzleShareResultRequestDto;
}
