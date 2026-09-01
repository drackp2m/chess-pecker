# training

La página del entrenamiento, que es el corazón de la aplicación. Un entrenamiento pasa por tres fases en este orden: la **calibración** busca el nivel del jugador a base de rondas; la **planificación** fija el conjunto de ejercicios y el ritmo diario; y luego se recorren los **ciclos**, cada uno una vuelta entera al mismo conjunto. Sólo puede haber un entrenamiento en curso.

Ojo a los tres niveles, que no son lo mismo: una **fase** es uno de esos tres momentos y su nombre nunca se escribe en la interfaz; una **etapa** es una fila del resumen, o sea una ronda de calibración o un ciclo; y un **ciclo** es una de las dos clases de etapa.

Los textos largos de esta página explican el método a alguien que lo está haciendo por primera vez: se traducen como prosa, no como jerga técnica calcada. Las etiquetas de los botones son imperativas y cortas.

## PHASE_*

La fase en la que está el entrenamiento, escrita como lo que la aplicación está haciendo ahora mismo: gerundio o frase corta en marcha, no un sustantivo. `PHASE_CANCELLED` es un entrenamiento que el jugador canceló, no uno que se perdió ni que falló.

## STATUS_*

La misma idea que `PHASE_*` pero en una sola palabra, para una etiqueta o una insignia junto al nombre. Aquí sí van sustantivos o adjetivos cortos, y tienen que caber en poco espacio.

## CALIBRATION_*

La fase de calibración. Una **exploración** es una ronda de un solo ejercicio que salta de nivel para acotar la zona; un **afinado**, una ronda de diez que afina alrededor del nivel encontrado. «Sube el nivel» o «baja el nivel» es que la ronda siguiente reparte ejercicios más difíciles o más fáciles: es una decisión sobre la dificultad, no sobre una posición del tablero ni sobre la profundidad de un cálculo.

## OUTCOME_*

El resultado de una ronda de calibración, tal como se le cuenta al jugador nada más terminarla. En `OUTCOME_ACCEPT` la calibración ha terminado y la banda encontrada es su nivel de trabajo.

## SET_*

El conjunto de ejercicios. Se elige una vez, se fija y ya no cambia: todos los ciclos recorren ese mismo conjunto. `{size}` es el número de ejercicios que tiene.

## PICK_THE_SET

Botón. Es elegir el tamaño del conjunto de ejercicios del entrenamiento, no elegir una opción cualquiera de una lista.

## COMMIT_TO_A_PACE

Encabezado. El jugador se compromete a un ritmo, a cuántos ejercicios va a hacer al día. La palabra tiene que sonar a compromiso, que es lo que sostiene el método.

## PACE_LABEL

Etiqueta de un campo numérico: ejercicios al día.

## CYCLE_*

Los ciclos del entrenamiento. `{index}` es el número del ciclo empezando por 1. En `CYCLE_TIMES` y `CYCLE_TARGET` los tiempos son duraciones ya formateadas por la aplicación: llegan hechas dentro del parámetro y no se tocan. `CYCLE_INCOMPLETE` es el aviso de un ciclo al que le faltan ejercicios en este dispositivo: `{stored}` son los que hay y `{expected}` los que debería tener. No es culpa del jugador y tiene arreglo, así que el tono es de aviso, no de alarma.

## CYCLE_PACE_*

El gráfico que compara lo hecho cada día con el ritmo pactado. `{delta}` es el saldo de ese día y `{drift}` el acumulado; los dos llegan ya con su signo. «Por delante» y «por detrás» son respecto al ritmo, no respecto a otro jugador.

## REPAIR_CYCLE

El botón que recompone un ciclo incompleto: vuelve a repartir los ejercicios que faltan por los huecos libres. Es una acción segura y no borra nada de lo ya hecho, así que la etiqueta no tiene que sonar a última opción.

## SET_STILL_DOWNLOADING

Sustituye al botón de reparar mientras el conjunto de ejercicios del entrenamiento no ha acabado de bajar a este dispositivo. No es un fallo ni pide nada al jugador: sólo dice que hay que esperar antes de poder reparar.

## DAILY_*

El gráfico de actividad diaria. Las tres primeras series parten en tres los ejercicios hechos, sin solaparse: **a la primera** (acertados al primer intento), **tras fallar** (encontrados, pero después de al menos un error) y **solución vista** (los que se abandonaron para ver la línea). Las otras dos cuentan otra cosa: **errores** son jugadas equivocadas dentro de un ejercicio, y **pistas** las ayudas pedidas. Cada etiqueta tiene que caber en una leyenda estrecha.

## PRACTICE_NOTICE_*

Aviso tranquilizador después de un fallo: el intento ya quedó registrado y lo que se haga a partir de ahí no cambia el resultado. El tono es de alivio, no de regañina.

## NOPE

Reacción inmediata a una jugada equivocada. Es coloquial y muy corta, casi una interjección; se traduce por lo que diría alguien en ese idioma delante del tablero, no por una frase correcta y larga.

## GAVE_UP_WATCHING

El jugador se ha rendido y la aplicación va a reproducirle la solución. «Mira cómo iba» es una invitación a mirar, no una orden.

## NOTHING_IN_PROGRESS

Texto de estado vacío. Explica que empezar un entrenamiento abre la calibración y que el nivel lo decide ella, no el jugador.

## REPLICA_INCOMPLETE

El entrenamiento todavía se está bajando del servidor a este dispositivo. No es un error: hay que esperar.

## CYCLE_NEEDS_REPAIR

Lo que ve quien entra a resolver por enlace directo con un ciclo al que le faltan ejercicios en este dispositivo. A diferencia de `REPLICA_INCOMPLETE`, aquí no basta con esperar: hay que volver a la pantalla del entrenamiento y reparar el ciclo.

## EMPTY_BAND

No hay ejercicios en esa banda de rating dentro del catálogo del servidor. El problema es del catálogo, no de lo que ha hecho el jugador.

## *_ERROR

Mensajes de error de una operación que no salió. Frase completa, con punto, en pasiva refleja o impersonal: se dice qué no se pudo hacer, sin culpar a nadie y sin pedir perdón.
