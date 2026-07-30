/**
 * Lo único que se puede contar de alguien con quien todavía no tienes relación: quién es y
 * cómo se llama. El email nunca sale de aquí, ni siquiera cuando la búsqueda acierta.
 */
export interface UserSummary {
	uuid: string;
	username: string;
}
