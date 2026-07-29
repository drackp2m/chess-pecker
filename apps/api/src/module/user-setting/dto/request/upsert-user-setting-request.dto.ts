import { IsDefined } from 'class-validator';

/**
 * El cuerpo es `{ "value": ... }` y el payload se guarda tal cual, envuelto: la base de
 * datos no valida qué hay dentro porque no sabe qué temas de tablero existen. Esa parte la
 * valida el front con `SettingPayload` y, cuando haga falta, un validador por clave aquí.
 */
export class UpsertUserSettingRequestDto {
	@IsDefined()
	value!: unknown;
}
