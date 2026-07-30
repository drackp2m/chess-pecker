import { faker } from '@faker-js/faker';
import { EntityData } from '@mikro-orm/core';

import { UserRole } from '../definition/user-role.enum';
import { User } from '../user.entity';

export interface UserFakerOptions {
	createdSince?: string | number | Date;
}

export class UserFaker {
	static makeOne(overrides?: EntityData<User>, options?: UserFakerOptions): User {
		const firstName = faker.person.firstName();
		const lastName = faker.person.lastName();

		const now = new Date();
		const createdAt = faker.date.between({
			from: options?.createdSince ?? faker.date.past({ years: 2, refDate: now }),
			to: now,
		});

		return new User({
			uuid: faker.string.uuid(),
			username: faker.internet.username({ firstName, lastName }),
			password: faker.internet.password({
				length: 32,
				memorable: false,
				pattern: /[A-Z0-9_\-*?.]/,
			}),
			email: faker.internet.email({ firstName, lastName }),
			role: faker.helpers.enumValue(UserRole),
			createdAt,
			updatedAt: faker.date.between({ from: createdAt, to: now }),
			...overrides,
		});
	}
}
