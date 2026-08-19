# dashboard

La página de inicio, la primera que se ve. Tiene tres partes: el resumen del programa en curso, los atajos a la práctica suelta, y la explicación del método Woodpecker para quien llega nuevo.

Es la página con más prosa de la aplicación. Los textos del método se leen enteros y de un tirón, así que se traducen como texto divulgativo —frases que fluyen, no viñetas telegráficas—, manteniendo el tono de quien explica algo que ha probado.

## YOUR_PROGRAM

Encabezado. El «programa» es el entrenamiento en curso del jugador, con todos sus ciclos.

## PROGRAM_TOTALS

## PROGRAM_CURRENT_*

Recuentos de ejercicios resueltos sobre el total, en distintos tramos del programa: el programa entero, los sondeos, el ajuste o un ciclo concreto. `{{ percentage }}` llega ya formateado con su símbolo y `{{ index }}` es el número del ciclo. La frase se lee de corrido y no lleva punto.

## PROGRAM_LEVEL

Fragmento que se pega detrás de otro con el separador « · ». `{{ rating }}` es un ELO.

## PROGRAM_*

Los botones del bloque del programa: afinar la calibración, empezar un bloque nuevo de ejercicios o continuar el ciclo en marcha. Imperativos, sin punto.

## PRACTICE

Encabezado del bloque de práctica suelta, la que no cuenta para el programa.

## METHOD_TITLE

El nombre del método. «Woodpecker» no se traduce nunca, ni se translitera.

## METHOD_INTRO

## METHOD_STEP_*

## METHOD_OUTRO

La explicación del método Woodpecker, en prosa seguida. La idea que no se puede perder por el camino: se repite el **mismo** conjunto de ejercicios, cada pasada más rápida, y un ejercicio fallado se marca y se deja atrás sin reintento. «Pasada» es una vuelta entera al conjunto. `METHOD_STEP_SHUFFLE` habla de barajar el orden dentro de bandas estrechas de rating, o sea de tramos de dificultad.

## ACTIVITY_*

El calendario de actividad, el cuadrito de días al estilo de las contribuciones de GitHub. `ACTIVITY_LEGEND_LESS` y `ACTIVITY_LEGEND_MORE` son los dos extremos de la leyenda de color: una palabra cada uno. `ACTIVITY_RANGE_MONTHS` es una etiqueta de botón muy apretada: `{{ months }}` seguido de la inicial de «mes» del idioma de destino, sin espacio.
