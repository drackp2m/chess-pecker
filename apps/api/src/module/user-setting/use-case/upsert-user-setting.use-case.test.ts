import { EntityManager } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';

import { createIntegrationTestingModule } from '../../../shared/test/create-integration-testing-module';
import { AppModule } from '../../app/app.module';
import { seedUser } from '../../sync/test/training-tree.fixture';
import { User } from '../../user/user.entity';
import { UserSettingModule } from '../user-setting.module';

import { GetUserSettingsUseCase } from './get-user-settings.use-case';
import { UpsertUserSettingUseCase } from './upsert-user-setting.use-case';

const KEY = 'move-animation';
const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.123Z');
const FUTURE = new Date('2099-01-01T00:00:00.000Z');

describe('UpsertUserSettingUseCase', () => {
	let module: TestingModule;
	let entityManager: EntityManager;
	let useCase: UpsertUserSettingUseCase;
	let listUseCase: GetUserSettingsUseCase;
	let user: User;

	beforeAll(async () => {
		module = await createIntegrationTestingModule({ imports: [AppModule, UserSettingModule] });

		entityManager = module.get(EntityManager);
		useCase = module.get(UpsertUserSettingUseCase);
		listUseCase = module.get(GetUserSettingsUseCase);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(async () => {
		await entityManager.fork().nativeDelete(User, {});

		user = await seedUser(entityManager, 'drackp2m');
	});

	it('stores the value at the date the device changed it', async () => {
		const stored = await useCase.execute(user, KEY, { value: 'always', updatedAt: OLD });

		expect(stored).toMatchObject({ key: KEY, value: { value: 'always' }, updatedAt: OLD });
		expect(await listUseCase.execute(user)).toHaveLength(1);
	});

	it('keeps the milliseconds of the date the device sent', async () => {
		const stored = await useCase.execute(user, KEY, { value: 'always', updatedAt: NEW });
		const [listed] = await listUseCase.execute(user);

		expect(stored.updatedAt).toStrictEqual(NEW);
		expect(listed?.updatedAt).toStrictEqual(NEW);
	});

	it('replaces the value saved again instead of adding a second row', async () => {
		const first = await useCase.execute(user, KEY, { value: 'first', updatedAt: OLD });
		await useCase.execute(user, KEY, { value: 'always', updatedAt: NEW });

		const settings = await listUseCase.execute(user);

		expect(settings).toHaveLength(1);
		expect(settings[0]).toMatchObject({
			uuid: first.uuid,
			value: { value: 'always' },
			createdAt: first.createdAt,
			updatedAt: NEW,
		});
	});

	it('does not let an older change overwrite a newer one, and answers with the newer', async () => {
		await useCase.execute(user, KEY, { value: 'always', updatedAt: NEW });

		const answer = await useCase.execute(user, KEY, { value: 'first', updatedAt: OLD });

		expect(answer).toMatchObject({ value: { value: 'always' }, updatedAt: NEW });
		expect((await listUseCase.execute(user))[0]).toMatchObject({
			value: { value: 'always' },
			updatedAt: NEW,
		});
	});

	it('lets a change at the same instant as the stored one take over', async () => {
		await useCase.execute(user, KEY, { value: 'first', updatedAt: NEW });
		await useCase.execute(user, KEY, { value: 'always', updatedAt: NEW });

		expect((await listUseCase.execute(user))[0]?.value).toStrictEqual({ value: 'always' });
	});

	it('stores falsy values as they came', async () => {
		await useCase.execute(user, 'move-lift', { value: false, updatedAt: OLD });

		expect((await listUseCase.execute(user))[0]?.value).toStrictEqual({ value: false });
	});

	it('stamps the change with the server clock when the device sends no date', async () => {
		const before = Date.now();

		const stored = await useCase.execute(user, KEY, { value: 'always' });

		expect(stored.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(stored.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it('stamps a change dated in the future with the server clock instead', async () => {
		const before = Date.now();

		const stored = await useCase.execute(user, KEY, { value: 'always', updatedAt: FUTURE });

		expect(stored.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(stored.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it('does not let a device running ahead outrank a later change', async () => {
		await useCase.execute(user, KEY, { value: 'first', updatedAt: FUTURE });
		await useCase.execute(user, KEY, { value: 'always', updatedAt: new Date() });

		expect((await listUseCase.execute(user))[0]?.value).toStrictEqual({ value: 'always' });
	});

	it("does not touch somebody else's settings", async () => {
		const other = await seedUser(entityManager, 'other');

		await useCase.execute(other, KEY, { value: 'never', updatedAt: NEW });
		await useCase.execute(user, KEY, { value: 'always', updatedAt: OLD });

		expect(await listUseCase.execute(other)).toHaveLength(1);
		expect((await listUseCase.execute(other))[0]?.value).toStrictEqual({ value: 'never' });
		expect((await listUseCase.execute(user))[0]?.value).toStrictEqual({ value: 'always' });
	});
});
