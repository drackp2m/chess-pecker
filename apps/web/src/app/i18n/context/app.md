# Chess Pecker

Chess Pecker entrena la táctica de ajedrez por repetición, siguiendo el método Woodpecker: se monta un conjunto de ejercicios al nivel del jugador y se recorre entero varias veces, cada pasada más rápida que la anterior, hasta que los patrones se reconocen de un vistazo. Es una aplicación web instalable (PWA) que sigue funcionando sin conexión; el servidor sólo guarda una copia de lo que se entrena en el dispositivo.

Quien la usa es un jugador de club, no un principiante. La jerga del tablero —jaque, mate, coronación, rey ahogado, casilla, banda de rating— se da por sabida y no se explica ni se parafrasea. Lo que sí hay que traducir con cuidado es el vocabulario propio de la aplicación —calibración, sondeo, ajuste, conjunto, ciclo, pasada, ritmo—, que está fijado en el glosario y significa siempre lo mismo en toda la interfaz.

Tono: directo, de tú, sin exclamaciones ni ánimo artificial. Las etiquetas de botones y de controles son cortas, imperativas y sin punto final; los mensajes de estado y de error son frases completas con punto. Un error dice qué ha pasado y qué se puede hacer, nunca pide perdón ni culpa a quien lo lee.

Reglas que valen para todos los idiomas:

- Los `{{ param }}` se copian tal cual, con el mismo nombre y las mismas veces que en el origen. Lo que hay dentro de las llaves no se traduce ni se declina.
- Los puntos suspensivos son el carácter «…», nunca tres puntos seguidos.
- El separador de fragmentos dentro de una línea es « · » (espacio, punto medio, espacio) y se conserva igual.
- La notación de ajedrez, el FEN y el PGN no se traducen ni se transliteran.
- Sólo lleva mayúscula la primera palabra de la frase y los nombres propios: nada de poner en mayúscula cada palabra de un título o de un botón.
- No se añade prosa que no esté en el origen: ni «por favor», ni aclaraciones de más, ni comentarios del traductor.
- Un texto de interfaz cabe en su hueco: la traducción no debería pasar de una vez y media la longitud del original.

## en-GB

Inglés británico: `colour`, `behaviour`, `synchronisation`, `catalogue`. Registro seco y económico; los botones en imperativo (`Start the cycle`, no `Click here to start`). Comillas dobles rectas cuando el original lleva comillas. El decimal es el punto y el millar la coma.

## ru-RU

Ruso, tuteo (`ты`): la aplicación habla a una sola persona y no la trata de usted. Los botones, en infinitivo, que es lo habitual en una interfaz rusa. Comillas «ёлочки». El vocabulario de ajedrez es el ruso de toda la vida —ладья, конь, слон, ферзь, пат, вариант— y nunca la transcripción del inglés. Los nombres propios de la lista `keep` se dejan en alfabeto latino.

## hi-IN

Hindi en devanagari, trato con `आप`. En la India el ajedrez se comenta en buena parte en inglés: donde no haya una palabra hindi de uso corriente, es preferible el préstamo inglés escrito en devanagari antes que una traducción inventada. Las cifras van en números arábigos (1, 2, 3), no en devanagari. Ojo con los falsos amigos del vocabulario de la aplicación: `ejercicio` es un ejercicio táctico, nunca ejercicio físico, y `partida` es una partida de ajedrez, nunca una coincidencia ni un emparejamiento.

## fr-FR

Francés de Francia. Los botones y las acciones, en infinitivo (`Enregistrer`, `Annuler`), que es la norma de las interfaces francesas; la prosa, de usted. Espacio fino antes de `:`, `;`, `!` y `?`, y comillas francesas con su espacio interior. Piezas: pion, cavalier, fou, tour, dame, roi.

## ca-ES

Català central, tuteo, como el original. Los botones en infinitivo (`Desar`, `Cancel·lar`). Comillas «» para las citas. Cuidado con los castellanismos del vocabulario de ajedrez y con la `l·l` de `cancel·lar`, `il·legal` o `col·locar`.
