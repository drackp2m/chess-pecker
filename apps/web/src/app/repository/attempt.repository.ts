import { Injectable } from '@angular/core';

import { AttemptSchema } from '@app/repository/definition/attempt-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class AttemptRepository extends GenericRepository<AttemptSchema> {}
