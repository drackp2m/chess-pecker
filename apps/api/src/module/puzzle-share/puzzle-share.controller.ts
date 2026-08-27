import type { PuzzleShare as PuzzleShareResponse } from '@chesspecker/api-definitions';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { CreatePuzzleShareRequestDto } from './dto/request/create-puzzle-share-request.dto';
import { PuzzleShareResultRequestDto } from './dto/request/puzzle-share-result-request.dto';
import { CreatePuzzleShareUseCase } from './use-case/create-puzzle-share.use-case';
import { GetPuzzleShareUseCase } from './use-case/get-puzzle-share.use-case';
import { ListPuzzleSharesUseCase } from './use-case/list-puzzle-shares.use-case';
import { PresentPuzzleSharesUseCase } from './use-case/present-puzzle-shares.use-case';
import { SubmitPuzzleShareAttemptUseCase } from './use-case/submit-puzzle-share-attempt.use-case';

@Controller('puzzle-share')
export class PuzzleShareController {
	constructor(
		private readonly createPuzzleShareUseCase: CreatePuzzleShareUseCase,
		private readonly listPuzzleSharesUseCase: ListPuzzleSharesUseCase,
		private readonly getPuzzleShareUseCase: GetPuzzleShareUseCase,
		private readonly submitPuzzleShareAttemptUseCase: SubmitPuzzleShareAttemptUseCase,
		private readonly presentPuzzleSharesUseCase: PresentPuzzleSharesUseCase,
	) {}

	/** Both lists are fixed words, so they come before the uuid route that would eat them. */
	@Get('received')
	async listReceived(@CurrentUser() user: User): Promise<PuzzleShareResponse[]> {
		return this.listPuzzleSharesUseCase.listReceived(user);
	}

	@Get('sent')
	async listSent(@CurrentUser() user: User): Promise<PuzzleShareResponse[]> {
		return this.listPuzzleSharesUseCase.listSent(user);
	}

	@Get(':uuid')
	async getOne(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
	): Promise<PuzzleShareResponse> {
		const share = await this.getPuzzleShareUseCase.execute(user, uuid);

		return this.presentPuzzleSharesUseCase.executeOne(share);
	}

	/**
	 * One call, however many friends it names: the front sends one at a time for now, and
	 * nothing here has to change when it stops doing that.
	 */
	@Post()
	async create(
		@CurrentUser() user: User,
		@Body() request: CreatePuzzleShareRequestDto,
	): Promise<PuzzleShareResponse> {
		return this.createPuzzleShareUseCase.execute(user, request);
	}

	@Post(':uuid/attempt')
	async submitAttempt(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Body() request: PuzzleShareResultRequestDto,
	): Promise<PuzzleShareResponse> {
		return this.submitPuzzleShareAttemptUseCase.execute(user, uuid, request);
	}
}
