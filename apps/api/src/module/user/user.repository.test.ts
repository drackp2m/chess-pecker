import { TestingModule } from '@nestjs/testing';

import { NotFoundException } from '../../shared/exception/not-found.exception';
import { createIntegrationTestingModule } from '../../shared/test/create-integration-testing-module';
import { AppModule } from '../app/app.module';

import { User } from './user.entity';
import { UserModule } from './user.module';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
	let module: TestingModule;
	let userRepository: UserRepository;

	beforeAll(async () => {
		module = await createIntegrationTestingModule({ imports: [AppModule, UserModule] });

		userRepository = module.get(UserRepository);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(async () => {
		await userRepository.deleteMany({});
	});

	it('should be defined', () => {
		expect(userRepository).toBeDefined();
	});

	describe('getOne', () => {
		it('throw NotFoundException when user not exists', async () => {
			const searchedUser = userRepository.getOne({ username: 'drackp2m' });

			await expect(searchedUser).rejects.toThrow(NotFoundException);
			await expect(searchedUser).rejects.toMatchObject({ response: { user: 'not exists' } });
		});

		it('should return User instance when exists', async () => {
			await userRepository.insert(
				new User({
					username: 'drackp2m',
					password: 'password',
				}),
			);

			const searchedUser = await userRepository.getOne({ username: 'drackp2m' });

			expect(searchedUser).toBeInstanceOf(User);
			expect(searchedUser.username).toStrictEqual('drackp2m');
		});
	});

	describe('insertOne', () => {
		it('should insert a user in the test database', async () => {
			const insertedUser = await userRepository.insert(
				new User({
					username: 'drackp2m',
					password: 'password',
				}),
			);

			const list = await userRepository.getMany();

			expect(list).toHaveLength(1);
			expect(insertedUser.username).toStrictEqual('drackp2m');
		});
	});
});
