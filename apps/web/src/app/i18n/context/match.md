# match

Una partida de ajedrez normal contra el motor de la máquina, sin ejercicios de por medio. Es lo que en la navegación se llama «Jugar». La palabra «partida» aquí es siempre la partida de ajedrez: nunca una coincidencia de búsqueda ni un emparejamiento entre jugadores.

Los textos son etiquetas de controles junto al tablero y avisos de estado de una línea.

## AGAINST_*

El título de la página. `AGAINST_MACHINE` se ve mientras se elige rival y bando; `AGAINST_OPPONENT` una vez empezada, con `{opponent}` como nombre del rival elegido (por ejemplo «Stockfish 18 Lite» o el de `LEGACY_ENGINE`), que se copia tal cual.

## CHECK

El jaque de ajedrez. Nunca «comprobar», «marcar» ni «revisar»: es el término del tablero.

## CHECKMATE_*

El resultado de la partida visto desde el jugador: ha ganado o ha perdido él, no las blancas o las negras. El tono es seco, sin celebración ni consuelo.

## YOUR_MOVE

Le toca mover al jugador. Muy corto, cabe en una tira estrecha.

## MACHINE_THINKING

El motor está calculando su jugada. «La máquina» es el rival de silicio: se puede traducir por lo que en cada idioma se llame al ordenador que juega, pero tiene que sonar a rival, no a proceso interno.

## SIDE*

El bando con el que se juega: blancas o negras. `SIDE` es la etiqueta del grupo de botones que empieza la partida con ese bando.

## CHOOSE_SIDE

Estado antes de empezar: el jugador tiene que elegir el rival y con qué bando juega. Muy corto, cabe en una tira estrecha.

## OPPONENT

La etiqueta del selector del rival de la partida.

## LEGACY_ENGINE

El nombre visible del rival original, conservado como alternativa al motor Stockfish.

## ELO

La etiqueta de la fuerza configurada para Stockfish. Se mantiene como «ELO».

## REVIEWING

Estado: el jugador ha retrocedido para volver a ver jugadas ya hechas. Si en esa posición le toca a él, puede mover y la partida sigue desde ahí. Muy corto.

## RESIGNED

La partida ha terminado porque el jugador se ha rendido. Mismo tono seco que `CHECKMATE_*`.

## DRAW_*

`DRAW_AGREED` es el final en tablas aceptadas por los dos bandos. `DRAW_DECLINED` avisa de que la máquina no ha aceptado las tablas que le ha propuesto el jugador y la partida sigue.

## OFFER_DRAW

Botón con el que el jugador propone tablas a su rival. Es la etiqueta accesible de un botón con icono.

## GO_TO_START

Llevar el tablero a la posición inicial de la partida para repasarla. No deshace ninguna jugada ni empieza otra partida.

## NEW_MATCH

Volver a elegir rival y bando para empezar otra partida. Sólo se puede cuando la actual ha terminado o el jugador todavía no ha movido.

## EXERCISE_POSITION

Se puede cargar en la partida la posición de un ejercicio para seguir jugándola. `LOAD_POSITION` es el botón que lo hace.

## FEN_UNREADABLE

El FEN pegado no se pudo interpretar. «FEN» no se traduce ni se explica.

## ILLEGAL_MOVE

`{notation}` es la jugada en notación algebraica, tal como se escribe en el tablero: se copia sin traducir ni transliterar. Las comillas del original son parte del texto y se sustituyen por las que use el idioma de destino.
