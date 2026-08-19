# match

Una partida de ajedrez normal contra el motor de la máquina, sin ejercicios de por medio. Es lo
que en la navegación se llama «Jugar». La palabra «partida» aquí es siempre la partida de
ajedrez: nunca una coincidencia de búsqueda ni un emparejamiento entre jugadores.

Los textos son etiquetas de controles junto al tablero y avisos de estado de una línea.

## PLAYING

Estado: hay una partida en marcha. Una sola palabra.

## CHECK

El jaque de ajedrez. Nunca «comprobar», «marcar» ni «revisar»: es el término del tablero.

## CHECKMATE_*

El resultado de la partida visto desde el jugador: ha ganado o ha perdido él, no las blancas o
las negras. El tono es seco, sin celebración ni consuelo.

## YOUR_MOVE

Le toca mover al jugador. Muy corto, cabe en una tira estrecha.

## MACHINE_THINKING

El motor está calculando su jugada. «La máquina» es el rival de silicio: se puede traducir por
lo que en cada idioma se llame al ordenador que juega, pero tiene que sonar a rival, no a
proceso interno.

## SIDE*

El bando con el que se juega: blancas o negras. `SIDE` es la etiqueta del control y `SIDE_HINT`
avisa de que cambiar de bando empieza una partida nueva, o sea que se pierde la que hay.

## UNDO_MOVE

Deshacer la última jugada de la partida. No es reiniciar ni empezar de nuevo.

## FLIP_BOARD

Girar el tablero para verlo desde el otro lado. Cambia sólo el punto de vista, no de bando.

## EXERCISE_POSITION

Se puede cargar en la partida la posición de un ejercicio para seguir jugándola. `LOAD_POSITION`
es el botón que lo hace.

## FEN_UNREADABLE

El FEN pegado no se pudo interpretar. «FEN» no se traduce ni se explica.

## ILLEGAL_MOVE

`{{ notation }}` es la jugada en notación algebraica, tal como se escribe en el tablero: se copia
sin traducir ni transliterar. Las comillas del original son parte del texto y se sustituyen por
las que use el idioma de destino.
