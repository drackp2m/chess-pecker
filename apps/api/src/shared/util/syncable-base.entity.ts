import { Entity, Property, Unique } from '@mikro-orm/core';

import { GenerateNowDateUseCase } from '../use-case/generate-now-date.use-case';

import { CustomBaseEntity } from './custom-base.entity';

/**
 * Lo que una tabla necesita para ser la réplica remota de otra que vive en el dispositivo.
 *
 * `clientRef` es el uuid con el que la fila nació allí. No es clave primaria —las reparte
 * el servidor, siempre— sino la clave de reintento: la subida busca por él antes de
 * insertar, así que repetir una que se cortó a mitad devuelve lo que ya hay en vez de
 * duplicarlo. Va con `unique` para que un choque se rechace limpio, y es nulo en las filas
 * que nacieron aquí.
 *
 * `receivedAt` es el reloj del servidor. `createdAt` y `updatedAt` los pone el cliente
 * —son datos del dominio y una subida offline los trae del pasado—, así que ninguno sirve
 * para preguntar «qué ha llegado desde la última vez» y ésta es la única marca con la que
 * se puede paginar una bajada.
 */
@Entity({ abstract: true })
export abstract class SyncableBaseEntity<
	T extends SyncableBaseEntity<T>,
> extends CustomBaseEntity<T> {
	@Unique()
	@Property({ nullable: true })
	clientRef?: string;

	@Property({ defaultRaw: 'now()', onUpdate: () => new GenerateNowDateUseCase().execute() })
	receivedAt: Date = new GenerateNowDateUseCase().execute();
}
