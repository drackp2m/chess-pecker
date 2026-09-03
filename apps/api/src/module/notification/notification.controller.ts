import {
	listNotificationsRequestSchema,
	readNotificationsRequestSchema,
} from '@chesspecker/api-definitions';
import type {
	ListNotificationsRequest,
	ReadNotificationsRequest,
	UserNotification as UserNotificationResponse,
} from '@chesspecker/api-definitions';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { ListNotificationsUseCase } from './use-case/list-notifications.use-case';
import { ReadNotificationsUseCase } from './use-case/read-notifications.use-case';

@Controller('notification')
export class NotificationController {
	constructor(
		private readonly listNotificationsUseCase: ListNotificationsUseCase,
		private readonly readNotificationsUseCase: ReadNotificationsUseCase,
	) {}

	@Get()
	async list(
		@CurrentUser() user: User,
		@Query({ schema: listNotificationsRequestSchema }) query: ListNotificationsRequest,
	): Promise<UserNotificationResponse[]> {
		return this.listNotificationsUseCase.execute(user, query);
	}

	@Post('read')
	@HttpCode(HttpStatus.NO_CONTENT)
	async read(
		@CurrentUser() user: User,
		@Body({ schema: readNotificationsRequestSchema }) request: ReadNotificationsRequest,
	): Promise<void> {
		return this.readNotificationsUseCase.execute(user, request);
	}
}
