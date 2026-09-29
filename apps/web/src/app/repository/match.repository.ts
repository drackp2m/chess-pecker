import { Injectable } from '@angular/core';

import { MatchSnapshot } from '@app/definition/match.type';
import {
	CURRENT_MATCH,
	MatchRow,
	MatchSchema,
} from '@app/repository/definition/match-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class MatchRepository extends GenericRepository<MatchSchema> {
	async read(): Promise<MatchRow | undefined> {
		return this.find('match', CURRENT_MATCH);
	}

	async save(snapshot: MatchSnapshot): Promise<MatchRow> {
		return this.insert('match', { ...snapshot, id: CURRENT_MATCH, updatedAt: new Date() });
	}
}
