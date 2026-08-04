import { Injectable } from '@angular/core';

import { CycleSchema } from '@app/repository/definition/cycle-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class CycleRepository extends GenericRepository<CycleSchema> {}
