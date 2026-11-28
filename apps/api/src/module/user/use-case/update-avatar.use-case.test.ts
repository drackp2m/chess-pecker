import { EntityManager } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';

import { NotFoundException } from '../../../shared/exception/not-found.exception';
import { createIntegrationTestingModule } from '../../../shared/test/create-integration-testing-module';
import { AppModule } from '../../app/app.module';
import { seedUser } from '../../sync/test/training-tree.fixture';
import { User } from '../user.entity';
import { UserModule } from '../user.module';

import { GetUserAvatarsUseCase } from './get-user-avatars.use-case';
import { UpdateAvatarUseCase } from './update-avatar.use-case';

describe('UpdateAvatarUseCase', () => {
	let module: TestingModule;
	let entityManager: EntityManager;
	let useCase: UpdateAvatarUseCase;
	let lookUp: GetUserAvatarsUseCase;
	let user: User;

	beforeAll(async () => {
		module = await createIntegrationTestingModule({ imports: [AppModule, UserModule] });

		entityManager = module.get(EntityManager);
		useCase = module.get(UpdateAvatarUseCase);
		lookUp = module.get(GetUserAvatarsUseCase);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(async () => {
		await entityManager.fork().nativeDelete(User, {});

		user = await seedUser(entityManager, 'drackp2m');
	});

	it('answers a user who never chose one with no avatar', async () => {
		expect(await lookUp.execute({ uuids: [user.uuid] })).toStrictEqual([
			{ uuid: user.uuid, avatar: null },
		]);
	});

	it('stores the avatar and answers with it', async () => {
		const avatar = { piece: 'knight', color: 'ivory', background: 'ink' } as const;

		expect(await useCase.execute(user, avatar)).toStrictEqual(avatar);
		expect(await lookUp.execute({ uuids: [user.uuid] })).toStrictEqual([
			{ uuid: user.uuid, avatar },
		]);
	});

	it('replaces the avatar saved before', async () => {
		await useCase.execute(user, { piece: 'pawn', color: 'red', background: 'ink' });
		await useCase.execute(user, { piece: 'king', color: 'blue', background: 'ivory' });

		expect(await lookUp.execute({ uuids: [user.uuid] })).toStrictEqual([
			{ uuid: user.uuid, avatar: { piece: 'king', color: 'blue', background: 'ivory' } },
		]);
	});

	it('refuses with a not found when the account is gone', async () => {
		await entityManager.fork().nativeDelete(User, {});

		await expect(
			useCase.execute(user, { piece: 'pawn', color: 'red', background: 'ink' }),
		).rejects.toThrow(NotFoundException);
	});

	it('looks up several accounts at once and leaves out the unknown ones', async () => {
		const other = await seedUser(entityManager, 'other');

		const found = await lookUp.execute({ uuids: [user.uuid, other.uuid, user.uuid, 'missing'] });

		const byUuid = (one: string, another: string): number => one.localeCompare(another);

		expect(found.map(({ uuid }) => uuid).sort(byUuid)).toStrictEqual(
			[user.uuid, other.uuid].sort(byUuid),
		);
	});
});
