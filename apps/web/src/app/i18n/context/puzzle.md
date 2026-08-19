# puzzle

La página de práctica suelta: se resuelven ejercicios cargados a mano, fuera de un entrenamiento. Nada de lo que pasa aquí cuenta para la calibración ni para los ciclos.

El ciclo de un ejercicio es siempre el mismo: se pide una jugada, si es la buena el tablero responde con la del rival, y si no lo es la deshace y deja intentarlo otra vez. Los mensajes son cortos y van en una tira de estado bajo el tablero, así que no pueden crecer mucho.

## PLAYING_SOLUTION

El tablero está reproduciendo la línea correcta él solo, sin que el jugador toque nada.

## WRONG_MOVE

La jugada no era la de la solución y el tablero la deshace. Es un aviso neutro, no un reproche: lo importante es que se puede volver a intentar.

## THAT_WAS_THE_LINE

Se acaba de enseñar la línea completa de la solución. «Línea» es la secuencia de jugadas del ejercicio, no una línea de texto ni una columna del tablero.

## SOLVED_AFTER_MISS

Resuelto, pero después de haber fallado al menos una vez. La distinción con `SOLVED` importa, porque es la que el método usa para medir la pasada siguiente: no se pueden traducir igual.

## PASTE_CSV_ROWS

Los ejercicios se importan pegando filas de un CSV o eligiendo un archivo. «Fila» es una línea del CSV, un ejercicio; nunca una fila del tablero.

## IMPORTED*

Resultado de la importación. `{{ loaded }}` son los ejercicios que entraron y `{{ skipped }}` las filas del CSV que no se pudieron leer y se descartaron.

## IMPORT_NOT_SAVED

Los ejercicios se cargaron y se pueden resolver, pero no se guardaron en este dispositivo para la próxima vez. Es un aviso parcial, no un fallo de la importación.

## FILE_UNREADABLE

`{{ name }}` es el nombre del archivo que eligió el jugador. Se copia tal cual, sin traducir ni recortar.
