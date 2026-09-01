# common

El scope raíz: todo lo que se usa desde más de una página. Aquí están la navegación, los controles del tablero, la accesibilidad de las casillas y las piezas, los estados de conexión y los errores que puede levantar cualquier pantalla.

Casi todo son etiquetas muy cortas, y muchas se reutilizan en sitios distintos: una traducción que sólo encaja en un contexto rompe el otro. Ante la duda, la palabra más neutra.

## NAV_MAIN

Etiqueta accesible del menú principal. No se ve en pantalla, la lee un lector de pantalla.

## HOME

La página de inicio. Una palabra.

## PLAY

Entrada de menú que lleva a la partida contra la máquina.

## MATCH

La partida contra la máquina. Nunca una coincidencia ni un emparejamiento.

## EXPLORATION

La exploración de la calibración: una ronda de un solo ejercicio, que salta de nivel para acotar la zona. Aquí es un sustantivo, la etiqueta de una etapa, y nunca el juego libre del tablero.

## REFINE

El afinado de la calibración: la ronda de diez ejercicios que afina el nivel encontrado. También un sustantivo, y nunca un ajuste de la aplicación.

## STAGE

Encabezado de la columna que nombra cada fila del resumen: una ronda de calibración (exploración o afinado) o un ciclo. Un ciclo es una etapa.

## CYCLE

`{index}` es el número del ciclo, desde 1.

## FIRST_TRY

Encabezado de la columna que cuenta los ejercicios acertados al primer intento sobre los repartidos. No es «resueltos»: el que falla y luego encuentra la línea no cuenta aquí. Tiene que caber en una columna estrecha.

## LINE

Etiqueta de la lista de jugadas de la solución. Es la línea de ajedrez, no una línea de texto.

## BOARD_*

Los botones de la barra del tablero, compartidos por todas las pantallas que lo pintan. Son etiquetas accesibles además de visibles, así que dicen la acción entera: retroceder una jugada, avanzar una jugada, girar el tablero. `BOARD_GIVE_UP` es rendirse en un ejercicio, que enseña la solución; no es abandonar una partida.

## PIECE_*

Los nombres de las piezas con su color, en minúscula, tal como se leen dentro de una frase de lector de pantalla. Se usa el nombre de la pieza en el ajedrez del idioma de destino, no una traducción literal del español.

## SQUARE_*

Textos accesibles de una casilla. `{square}` es la coordenada algebraica (e4, d5) y no se traduce; `{piece}` llega ya traducido desde `PIECE_*`, así que la frase tiene que sonar bien con ese nombre metido dentro y con su género y su número.

## FIND_MOVE_*

La consigna de un ejercicio: encontrar la jugada que le toca a ese bando.

## DEMO_*

La demostración del tablero que se ve en la página de ajustes y en la de inicio. `DEMO_TASK` dice qué hay que hacer y tiene que decir lo mismo que el `BOARD_INTRO` del scope `setting`.

## DIFFICULTY*

`DIFFICULTY` lleva dentro `{level}`, que se rellena con uno de los `DIFFICULTY_EASY`, `DIFFICULTY_MEDIUM` o `DIFFICULTY_HARD`. Por eso los tres van en minúscula y tienen que concordar con la palabra «dificultad» del idioma de destino.

## CONNECTING*

La aplicación está hablando con el servidor y todavía no sabe si responde. Es una espera, no un error.

## WAKING*

El servidor está en un plan gratuito y se duerme; despertarlo tarda hasta un minuto. Tampoco es un error, y el texto tiene que tranquilizar en vez de alarmar.

## NO_CONNECTION*

No se llega al servidor. Lo importante del mensaje es lo que sigue funcionando sin él.

## UPDATE_*

Avisos del service worker sobre una versión nueva de la aplicación, y el botón que la aplica. `{version}` es un número de versión y se copia tal cual.

## APP_UPDATED

Confirmación de que la actualización ya está puesta. La «v» pegada al `{version}` es parte del formato y se conserva.

## SELECT_*

Textos de un desplegable genérico: el marcador de posición cuando no hay nada elegido, el aviso de que la búsqueda no encuentra nada, la posición leída en voz alta y el botón que quita una opción ya elegida de un desplegable de selección múltiple, donde `{option}` es el nombre de esa opción.

## PROMOTION_DIALOG

Título del diálogo que sale cuando un peón llega a la última fila y hay que elegir en qué pieza se convierte.

## PROMOTE_TO*

La coronación en sí. `PROMOTE_TO` encabeza la lista y `PROMOTE_TO_PIECE` es cada botón, con `{piece}` ya traducido desde `PIECE_*`: la frase tiene que sonar bien con ese nombre dentro.

## CHART_*

Avisos para quien desarrolla, no para quien juega: un gráfico que no cabe en su hueco. Se traducen igual, pero el tono puede ser más técnico.

## SETTINGS_*

Errores de los ajustes guardados en este dispositivo. `SETTINGS_BLOCKED_UPGRADE` pide cerrar las demás pestañas para poder migrar la base de datos local, que es una restricción del navegador.

## SERVER_*

`SERVER_DETAIL` es un contenedor: `{detail}` llega en inglés desde el servidor y no se traduce.

## PENDING_SYNC_*

Diálogo que sale al cerrar sesión con ejercicios sin subir. Es la advertencia más seria de la aplicación: al cerrar sesión se pierden de verdad. `{pending}` es el número de ejercicios en peligro. `PENDING_SYNC_REJECTED` es el otro caso, que sale junto al anterior o solo: `{rejected}` son los que el servidor ya rechazó y no se reintentan, y que se borran igual.

## SYNC_*

Los estados que pinta el indicador de sincronización de la cabecera. Muy cortos. Subir es del dispositivo al servidor y bajar al revés.

## *_FAILED

Una operación de sesión que no salió y que se puede reintentar. Frase completa con punto.

## WRONG_CREDENTIALS

Credenciales incorrectas. No se dice nunca cuál de las dos falló, si el usuario o la contraseña.

## NO_SUCH_ACCOUNT

No existe ninguna cuenta con ese nombre de usuario.

## BOOKMARK_*

El marcador: la lista en la que el jugador guarda un ejercicio ya terminado. Sólo una a la vez, así que guardarlo otra vez lo mueve de lista, no lo duplica. Los nombres de las cuatro listas van en plural, porque son las listas que después se podrán abrir. `BOOKMARK_ADD` y `BOOKMARK_EDIT` son etiquetas accesibles del icono, no se ven en pantalla. `BOOKMARK_SKIP_PROMPT` no habla del ejercicio que se está guardando, sino de lo que hará la pulsación corta a partir de ahora, así que elegir otra lista no la contradice. En `BOOKMARK_SKIP_PROMPT_HINT`, «mantén pulsado» es el gesto de dejar el dedo sobre el icono, nunca el de pulsar repetidas veces.

## SHARE_*

Compartir un ejercicio ya terminado con un amigo, que aquí es un reto: quien lo recibe lo resuelve y después se comparan los resultados de todos los que hayan participado. `SHARE` es la etiqueta accesible del icono, no se ve en pantalla. `SHARE_FRIEND` es la etiqueta de un selector, una palabra. `SHARE_MESSAGE` es opcional y `SHARE_MESSAGE_PLACEHOLDER` lo dice sin ordenar nada. En `SHARE_SENT`, `{username}` puede ser más de un nombre separado por comas. `SHARE_CHALLENGE_RECEIVED` y `SHARE_CHALLENGE_SOLVED` son avisos que llegan solos: `{username}` es siempre otra persona, nunca quien lee.
