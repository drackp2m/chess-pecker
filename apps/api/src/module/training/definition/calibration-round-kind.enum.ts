export enum CalibrationRoundKind {
	/** Sondeo: un ejercicio suelto, para acotar la zona de ELO. */
	Scan = 'scan',
	/** Afinado: diez ejercicios del mismo ELO, para medir la tasa de acierto. */
	Refine = 'refine',
}
