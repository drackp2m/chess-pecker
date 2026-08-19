# profile

La página de perfil: la cuenta y los amigos. Tiene cuatro listas —solicitudes recibidas,
solicitudes enviadas, amigos y bloqueados—, cada una con su encabezado, su texto de lista vacía
y los botones de cada fila.

Los botones de fila son muy cortos porque van varios en la misma línea. Los mensajes de
confirmación son frases completas con punto, en pasado y sin celebración.

## YOUR_ACCOUNT

## SESSION_OPEN

## LOGGED_IN_AS

El bloque de la cuenta. `{{ username }}` es el nombre que eligió el jugador: se copia tal cual,
sin traducir ni cambiarle las mayúsculas.

## UNREACHABLE_EXPLANATION

El servidor no responde y no hay forma de saber si la sesión sigue abierta. El párrafo tiene dos
trabajos: explicar que puede estar despertando —tarda hasta un minuto en el plan gratuito— y
tranquilizar diciendo qué sigue funcionando sin él. Los dos hay que conservarlos.

## ANONYMOUS_EXPLANATION

Para quien no ha iniciado sesión: para qué sirve una cuenta. Lo que vende es que el programa te
acompaña entre dispositivos.

## ADD_FRIEND*

El buscador de gente. Se busca por el principio del nombre de usuario, y no se envía nada hasta
elegir un resultado: es una aclaración deliberada y no se puede perder.

## NO_MATCH_FOR

La búsqueda no encontró a nadie. `{{ term }}` es lo que escribió el jugador y va entre comillas:
se usan las comillas del idioma de destino.

## REQUESTS_*

## NOTHING_WAITING

## NONE_SENT

Las dos listas de solicitudes con sus textos de lista vacía. Una «solicitud» es la petición de
amistad de un jugador a otro.

## ACCEPT

## DECLINE

Botones de una solicitud recibida, uno al lado del otro. Una palabra cada uno.

## BLOCK

## UNBLOCK

## BLOCKED

## NOBODY_BLOCKED

Bloquear a alguien impide que vuelva a mandar solicitudes. `BLOCKED` es el encabezado de la
lista, en plural, y las otras son acciones.

## UNFRIEND

## NO_LONGER_FRIEND

Deshacer una amistad. En los idiomas que no tengan un verbo para esto, una frase corta y natural
antes que un calco del inglés.

## FRIENDS

## NO_FRIENDS

La lista de amigos y su texto de lista vacía.

## REQUEST_*

## REMOVED

## USER_BLOCKED

## UNBLOCKED

Confirmaciones que salen en un aviso pasajero después de una acción. Muy cortas, en pasado.

## *_ERROR

Errores de una operación de amistad que no salió. Frase completa con punto, impersonal, sin
pedir perdón.
