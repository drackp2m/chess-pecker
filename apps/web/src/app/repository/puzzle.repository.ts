import { Injectable } from '@angular/core';

import { PuzzleSchema } from '@app/repository/definition/puzzle-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class PuzzleRepository extends GenericRepository<PuzzleSchema> {}
