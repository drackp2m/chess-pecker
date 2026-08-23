# setting

La página de ajustes. Aquí un «ajuste» es una preferencia de la aplicación, no la ronda de calibración del entrenamiento.

Cada bloque tiene un encabezado corto y un párrafo de introducción debajo. Los encabezados son sustantivos de una o dos palabras; las etiquetas de los controles y las opciones son cortas, sin punto final y sin repetir el nombre del bloque. Los párrafos sí son prosa con punto.

## APPEARANCE_*

El aspecto de la aplicación entera. Las tres opciones son el tema: seguir al sistema, claro y oscuro. Van en una fila de tres botones, así que tienen que ser muy cortas.

## LANGUAGE_*

El idioma de la interfaz. La advertencia importa: la notación de ajedrez no cambia de idioma.

## BOARD_INTRO

Explica que la tira de abajo es un ejercicio de verdad y que se puede fallar a propósito para ver cómo se comporta cada ajuste. «Cómete la torre negra» es la consigna de ese ejercicio y tiene que decir lo mismo que `common.DEMO_TASK`.

## MOVE_SPEED*

La velocidad de lo que el tablero juega solo. Las tres opciones —lenta, normal, rápida— son adjetivos cortos y concuerdan con «velocidad» en el idioma de destino.

## SPEED_*

Las opciones de velocidad, en una fila de tres. Una sola palabra cada una.

## MOVE_ANIMATION*

Cuánto se desliza una pieza al moverse, en vez de aparecer de golpe en su casilla. «Sólo hacia delante» quiere decir al avanzar por la línea pero no al retroceder; «sólo al jugarse por primera vez», que una jugada ya vista no se vuelve a animar.

## MOVE_INPUT*

Cómo se introduce una jugada: haciendo clic en la pieza y luego en la casilla de destino, o arrastrándola. Son las dos formas de mover, no una configuración de teclado.

## SOUND*

El sonido del tablero. `SOUND_TOGGLE` es la etiqueta de un interruptor, y aun así se escribe como una acción y no como un sustantivo.

## SYNC_TITLE

Encabezado del bloque de sincronización.

## SYNC_INTRO

Explica el modelo de datos de la aplicación: se entrena contra el dispositivo y el servidor guarda una copia. Conviene que quede claro que el dispositivo manda.

## SYNC_*

Estado de la sincronización. **Subir** es siempre del dispositivo al servidor y **bajar** del servidor al dispositivo: no vale «sincronizar» para una sola dirección, porque la página distingue las dos. Una fila «rechazada» es un cambio que el servidor no aceptó y que sigue aquí esperando; no es un cambio perdido.

## SYNC_ROWS

`{{ count }}` es un número de filas guardadas en este dispositivo, y puede ser 0.

## SYNC_CURSOR

Hasta dónde se ha bajado. `{{ at }}` es una fecha ya formateada por la aplicación.

## SYNC_STALE

Algo lleva demasiados días sin subir. `{{ days }}` es un número de días.

## SYNC_ENTITY_*

Los nombres de las tablas que se sincronizan, tal como se listan en un recuento. Van en plural y son etiquetas de una columna estrecha. Un «hueco de ciclo» es la posición que ocupa un ejercicio dentro de un ciclo, no un espacio vacío ni un intervalo de tiempo.

## VERSION

`{{ version }}` es el número de versión de la aplicación. La palabra va en minúscula porque se pinta al pie de la página.
