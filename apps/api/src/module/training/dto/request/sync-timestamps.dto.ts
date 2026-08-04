import type { SyncTimestamps } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

/**
 * Las fechas viajan desde el cliente porque son datos del dominio, no de fontanería: quien
 * entrena sin cuenta durante semanas y luego se registra se llevaría toda su cronología a
 * la fecha de registro si las generase el servidor.
 *
 * Son opcionales para que un cliente en línea no tenga que mandarlas; cuando faltan, valen
 * las del servidor. Cuando llegan, `ApplySyncTimestampsUseCase` las valida antes de usarlas.
 */
export class SyncTimestampsDto implements SyncTimestamps<Date> {
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdAt?: Date;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	updatedAt?: Date;
}
