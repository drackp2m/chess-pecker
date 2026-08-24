# dashboard

La página de inicio, la primera que se ve. Tiene tres partes: el resumen del programa en curso, los atajos a la práctica suelta, y el gancho al método Woodpecker para quien llega nuevo.

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

## METHOD_SUMMARY

## METHOD_OPEN

El bloque del método en el inicio, ya reducido a un gancho y un botón: la explicación entera vive en la scope `intro`. `METHOD_SUMMARY` es una sola frase que resume la idea —el **mismo** conjunto de ejercicios, pasada tras pasada, hasta reconocer la idea táctica de un vistazo— y `METHOD_OPEN` es la etiqueta del botón que abre esa presentación.

## ACTIVITY_*

El calendario de actividad, el cuadrito de días al estilo de las contribuciones de GitHub. `ACTIVITY_LEGEND_LESS` y `ACTIVITY_LEGEND_MORE` son los dos extremos de la leyenda de color: una palabra cada uno. `ACTIVITY_RANGE_MONTHS` es una etiqueta de botón muy apretada: `{{ months }}` seguido de la inicial de «mes» del idioma de destino, sin espacio.
