import { Entity, Index, Property } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';

import { PuzzleRepository } from './puzzle.repository';

/**
 * Catálogo global de ejercicios, compartido por todos los usuarios.
 *
 * `lichessId` es la clave natural: la importación es un upsert por él, y es la referencia
 * que manda el front cuando sube un set montado desde un CSV local, porque los uuid que
 * ese navegador inventó no son los de aquí.
 */
@Entity({ repository: () => PuzzleRepository })
export class Puzzle extends CustomBaseEntity<Puzzle> {
	@Property({ unique: true })
	lichessId!: string;

	/** Posición *antes* de la jugada del rival. */
	@Property({ type: 'text' })
	fen!: string;

	/** UCI; `moves[0]` es la jugada del rival, que se reproduce al abrir el ejercicio. */
	@Property({ type: 'string[]' })
	moves!: string[];

	/** ELO exacto de Lichess. La franja de centena es `rating / 100`, no se almacena. */
	@Index()
	@Property()
	rating!: number;

	@Index({ type: 'gin' })
	@Property({ type: 'string[]' })
	themes!: string[];
}
