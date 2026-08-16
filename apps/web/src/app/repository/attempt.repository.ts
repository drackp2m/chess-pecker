import { Injectable } from '@angular/core';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class AttemptRepository extends GenericRepository<AppSchema> {}
