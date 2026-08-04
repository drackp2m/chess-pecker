import { Injectable } from '@angular/core';

import { PuzzleSetSchema } from '@app/repository/definition/puzzle-set-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class PuzzleSetRepository extends GenericRepository<PuzzleSetSchema> {}
