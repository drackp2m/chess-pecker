import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { NotificationController } from './notification.controller';
import { CreateNotificationsUseCase } from './use-case/create-notifications.use-case';
import { ListNotificationsUseCase } from './use-case/list-notifications.use-case';
import { ReadNotificationsUseCase } from './use-case/read-notifications.use-case';
import { UserNotification } from './user-notification.entity';

/**
 * Writing is exported and reading is not: whoever raises an event says what the notice
 * means, while listing and marking read belong to the inbox alone.
 */
@Module({
	imports: [MikroOrmModule.forFeature([UserNotification])],
	providers: [CreateNotificationsUseCase, ListNotificationsUseCase, ReadNotificationsUseCase],
	exports: [CreateNotificationsUseCase],
	controllers: [NotificationController],
})
export class NotificationModule {}
