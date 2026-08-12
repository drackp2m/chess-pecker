/** Un store con datos del usuario dentro, que el cierre de sesión tiene que dejar vacío. */
export interface Resettable {
	reset(): void;
}
