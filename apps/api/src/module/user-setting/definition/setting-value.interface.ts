/**
 * El payload va envuelto en lugar de suelto para que un ajuste escalar pueda ganar campos
 * más adelante sin cambiar el tipo de la columna.
 */
export interface SettingValue<T = unknown> {
	value: T;
}
