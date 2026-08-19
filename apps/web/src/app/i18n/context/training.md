# training

La página del entrenamiento, que es el corazón de la aplicación. Un entrenamiento tiene tres
tramos en este orden: la **calibración** busca el nivel del jugador a base de rondas; la
**planificación** fija el conjunto de ejercicios y el ritmo diario; y luego se recorren los
**ciclos**, cada uno una vuelta entera al mismo conjunto. Sólo puede haber un entrenamiento en
curso.

Los textos largos de esta página explican el método a alguien que lo está haciendo por primera
vez: se traducen como prosa, no como jerga técnica calcada. Las etiquetas de los botones son
imperativas y cortas.

## PHASE_*

El tramo en el que está el entrenamiento, escrito como lo que la aplicación está haciendo ahora
mismo: gerundio o frase corta en marcha, no un sustantivo. `PHASE_ABANDONED` es un
entrenamiento que el jugador canceló, no uno que se perdió ni que falló.

## STATUS_*

La misma idea que `PHASE_*` pero en una sola palabra, para una etiqueta o una insignia junto al
nombre. Aquí sí van sustantivos o adjetivos cortos, y tienen que caber en poco espacio.

## CALIBRATION_*

La fase de calibración. Un **sondeo** es una ronda de un solo ejercicio que salta de nivel; un
**ajuste**, una ronda de diez que afina alrededor del nivel encontrado. «Sondear más alto» o
«más bajo» es probar con ejercicios más difíciles o más fáciles: es una decisión sobre la
dificultad, no sobre una posición del tablero ni sobre la profundidad de un cálculo.

## OUTCOME_*

El resultado de una ronda de calibración, tal como se le cuenta al jugador nada más terminarla.
En `OUTCOME_ACCEPT` la calibración ha terminado y la banda encontrada es su nivel de trabajo.

## SET_*

El conjunto de ejercicios. Se elige una vez, se fija y ya no cambia: todos los ciclos recorren
ese mismo conjunto. `{{ size }}` es el número de ejercicios que tiene.

## PICK_THE_SET

Botón. Es elegir el tamaño del conjunto de ejercicios del entrenamiento, no elegir una opción
cualquiera de una lista.

## COMMIT_TO_A_PACE

Encabezado. El jugador se compromete a un ritmo, a cuántos ejercicios va a hacer al día. La
palabra tiene que sonar a compromiso, que es lo que sostiene el método.

## PACE_LABEL

Etiqueta de un campo numérico: ejercicios al día.

## CYCLE_*

Los ciclos del entrenamiento. `{{ index }}` es el número del ciclo empezando por 1. En
`CYCLE_TIMES` y `CYCLE_TARGET` los tiempos son duraciones ya formateadas por la aplicación:
llegan hechas dentro del parámetro y no se tocan.

## CYCLE_PACE_*

El gráfico que compara lo hecho cada día con el ritmo pactado. `{{ delta }}` es el saldo de ese
día y `{{ drift }}` el acumulado; los dos llegan ya con su signo. «Por delante» y «por detrás»
son respecto al ritmo, no respecto a otro jugador.

## DAILY_*

El gráfico de actividad diaria. Cada serie es una etiqueta de leyenda de una o dos palabras:
resueltos, fallados, rendidos (los que abandonó para ver la solución), errores (jugadas
equivocadas dentro de un ejercicio) y pistas. Tienen que caber en una leyenda estrecha.

## PRACTICE_NOTICE_*

Aviso tranquilizador después de un fallo: el intento ya quedó registrado y lo que se haga a
partir de ahí no cambia el resultado. El tono es de alivio, no de regañina.

## NOPE

Reacción inmediata a una jugada equivocada. Es coloquial y muy corta, casi una interjección; se
traduce por lo que diría alguien en ese idioma delante del tablero, no por una frase correcta y
larga.

## GAVE_UP_WATCHING

El jugador se ha rendido y la aplicación va a reproducirle la solución. «Mira cómo iba» es una
invitación a mirar, no una orden.

## NOTHING_IN_PROGRESS

Texto de estado vacío. Explica que empezar un entrenamiento abre la calibración y que el nivel
lo decide ella, no el jugador.

## REPLICA_INCOMPLETE

El entrenamiento todavía se está bajando del servidor a este dispositivo. No es un error: hay
que esperar.

## EMPTY_BAND

No hay ejercicios en esa banda de rating dentro del catálogo del servidor. El problema es del
catálogo, no de lo que ha hecho el jugador.

## *_ERROR

Mensajes de error de una operación que no salió. Frase completa, con punto, en pasiva refleja o
impersonal: se dice qué no se pudo hacer, sin culpar a nadie y sin pedir perdón.
