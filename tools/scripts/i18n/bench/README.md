# bench — el banco de pruebas del traductor

Cuarenta y tantas unidades del catálogo elegidas a mano, cada una con **la traducción buena
escrita al lado**. Es el patrón contra el que se miden los modelos: `--compare --reference` lee
estos ficheros y todo lo que salga de `--bench` (paso 4.2) se puntúa contra ellos.

No es una traducción de producción. Nada de aquí entra en `apps/web/src/app/i18n/*.json`, y
**`pnpm i18n:import` no debe apuntar nunca a este directorio**: las unidades sintéticas de
`bench-icu` llevan identificadores que no existen en el catálogo y el importador las ofrecería
como claves nuevas.

## Los ficheros

| Fichero                              | Qué es                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `bench.json`                         | La selección: qué unidad entra, en qué eje y por qué                                 |
| `gold/en-GB.json`, `gold/ru-RU.json` | La traducción buena, indexada por `scope.CONSTANTE`                                  |
| `en-GB.xlf`, `ru-RU.xlf`             | El banco con la traducción buena dentro: la referencia. **Generado**                 |
| `en-GB.blank.xlf`, `ru-RU.blank.xlf` | Las mismas unidades con el `<target>` vacío: lo que se le da al modelo. **Generado** |
| `build.mjs`                          | Rehace los cuatro `.xlf` desde el catálogo y el `gold/`                              |

Se edita `gold/` y se vuelve a generar:

```sh
node tools/scripts/i18n/bench/build.mjs
```

Sale por pantalla cuántas unidades ha escrito por idioma, avisa de la que se haya quedado sin
traducción buena y de la que sobre en `gold/`, y termina en 1 si falta alguna. Los `.xlf` no se
editan a mano: se toca `gold/` y se regenera. El origen español,
las notas, el glosario y los `<ph>` los saca de donde los saca la exportación de verdad, así que
el fichero que ve el modelo es indistinguible de un `pnpm i18n:export`.

## Qué se mide

Treinta y dos unidades reales del catálogo, repartidas en seis ejes. La columna «eje» de
`bench.json` los nombra y cada entrada dice por qué está:

| Eje                 | Unidades | Qué pone a prueba                                                                                 |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| corta sin contexto  | 7        | Una palabra suelta y ambigua: `Línea`, `Partida`, `Afinado`. Sin glosario no hay forma de acertar |
| género entre claves | 8        | Una clave rellena el hueco de otra y la concordancia cruza las dos                                |
| parámetros          | 6        | De uno a siete huecos, pegados a texto o solos en la cadena                                       |
| número              | 4        | Recuentos que hoy son plural fijo y mañana serán ramas ICU                                        |
| texto largo         | 4        | Cuatro frases seguidas, donde se ve si el modelo resume o inventa                                 |
| imperativo          | 2        | El español manda de tú y el ruso quiere infinitivo                                                |
| tipografía          | 1        | Comillas por idioma alrededor de un hueco que no se traduce                                       |

El eje que más discrimina es el de **género entre claves**, y conviene entender por qué. La
aplicación compone frases con piezas sueltas: `SQUARE_PIECE` es `«{{ piece }} en {{ square }}»` y
el hueco lo rellena un `PIECE_*` ya traducido. Traducidas por separado, cada pieza sale bien y la
frase compuesta sale mal:

- `dama negra` es femenino en español y `ферзь` es **masculino** en ruso → `чёрный ферзь`.
- `peón negro` es masculino en español y `пешка` es **femenino** en ruso → `чёрная пешка`.

Un modelo que traduzca palabra a palabra acierta el sustantivo y falla el adjetivo, y eso no lo
detecta ninguna de las métricas duras de `validate.py`. Aquí sí, porque la traducción buena está
escrita.

Los dos casos de `SQUARE_CAPTURE` y `PROMOTE_TO_PIECE` van más allá: el ruso pediría acusativo
(«взять белую ладью») y el hueco llega siempre en nominativo. No hay traducción literal correcta,
así que la traducción buena **esquiva el caso** con dos puntos. Es un límite del diseño de la
aplicación, no del modelo, y está en el banco para que se vea: si un modelo declina el hueco, está
produciendo una frase que en pantalla saldrá rota.

## El bloque `bench-icu`

Los `.xlf` traen un `<file id="bench-icu">` con unidades **sintéticas**: emulan lo que la
exportación con fan-out (paso 9 del índice) va a emitir cuando el catálogo hable ICU. Cada una es
una rama de un plural o de un `select` de género, con las notas que ese paso promete —`category`,
`examples`, `siblings`, `gender-note`—, el origen puesto siempre en la rama `other` del español.

Están porque sin ellas el banco mediría el catálogo de hoy y la decisión del paso 4.4 se toma
sobre el de mañana. El ruso pasa de una unidad a cuatro por cada clave con plural, y la pregunta
que hay que contestar —«¿este modelo vale para `ru-RU`?»— no es la misma cuando lo que se le pide
es una rama `few` con una nota que dice «se usa con 2, 3, 4, 22» en vez de una frase entera.

Tres claves, y el reparto por idioma es el que pide cada uno:

| Clave                         | Tipo   | en-GB               | ru-RU                 |
| ----------------------------- | ------ | ------------------- | --------------------- |
| `puzzle.IMPORTED`             | plural | one, other          | one, few, many, other |
| `common.PENDING_SYNC_MESSAGE` | plural | one, other          | one, few, many, other |
| `training.GAVE_UP_WATCHING`   | género | male, female, other | male, female, other   |

La de género es la más interesante de las tres: el español **no marca género** en «te has
rendido», así que las tres ramas del origen son idénticas y el ruso tiene que producir
«сдался» / «сдалась» sin nada en el origen que se lo sugiera. Y la rama `other` no puede
inventarse una terminación: la traducción buena reformula («Попытка завершена») para que no haya
nada que concordar. En inglés las tres ramas son iguales a propósito — un modelo que se invente
variación donde el idioma no la tiene también está fallando.

Dos diferencias con lo que emitirá el paso 9, y las dos a favor de poder medir hoy:

- El hueco del número viaja como `{{ loaded }}` y no como el `#` de ICU. Así lo cuenta el control
  de marcadores de `validate.py`; con un `#` pelado, perderlo no dispararía ningún aviso.
- El identificador es `puzzle.IMPORTED#plural:few` y no `puzzle.01KZ…#plural:few`. La forma
  `clave#ruta` es la del plan; el ULID se pone cuando el fan-out sea real.

## Cosas sabidas antes de leer las tablas

- **`common.PENDING_SYNC_MESSAGE` va a dar siempre un aviso de glosario, en los dos idiomas.** El
  origen dice «Al cerrar sesión», donde «sesión» es parte de «cerrar sesión» y no el sustantivo del
  glosario; la traducción correcta es «logging out» / «при выходе из аккаунта» y no lleva
  `session` / `сессия`. El aviso es de la comprobación, no del modelo: no cuenta.
- **`common.SERVER_DETAIL` es sólo el hueco.** La única respuesta correcta es devolverlo intacto.
  Puntúa 100 o puntúa mal, no hay término medio, y es donde un modelo pequeño se pone a inventar.
- **La traducción buena de `en-GB` no es la del catálogo.** Cuatro unidades la corrigen a
  propósito, porque el `en-GB.json` de hoy contradice el glosario: `REFINE` («Refine» → «Refinement»),
  `FIRST_TRY` («Solved» → «First try»), `DAILY_SERIES_SHOWN` («Resigned» → «Solution shown») y
  `EXPLORATION` («Scan» → «Exploration»). Medir contra el catálogo habría premiado el error.
- **`ru-RU` está vacío en el catálogo**, así que su mitad del banco no sale de ninguna traducción
  previa. Es texto escrito para esto.
- **Las notas del fan-out no llegan hoy al modelo.** El prompt sólo monta las notas `context`,
  `term` y `param`; `category`, `examples` y `siblings` se quedan en el XLIFF sin leer. El modelo
  ve cuatro veces la misma frase española sin que nada le diga qué rama es cada una, así que
  devuelve la misma traducción cuatro veces. **La columna `bench-icu` no mide al modelo hasta que
  el paso 12 monte esas notas en el prompt**, y el fan-out del paso 9 no se puede validar antes.
- **`hi-IN` no está.** El paso 4.4 tiene que decidir también sobre el hindi y este banco no le da
  nada: hacen falta cuarenta traducciones al hindi escritas por alguien que lo hable. Hasta
  entonces, la decisión sobre `hi-IN` se toma sin patrón debajo.

## Cómo se usa

Con `--bench`, que es el arnés del paso 4.2: coge estos ficheros, los pasa por cada modelo de la
lista, puntúa cada pasada contra la traducción buena de al lado y deja un markdown con las tablas
una debajo de otra. El guion entero está en el README del traductor, en «Generating a model
comparison».

```sh
cd tools/scripts/i18n/translate

# Los dos idiomas del banco por tres modelos y DeepL
uv run translate --bench --model gemma-12b-qat,gemma4-e4b,qwen35-9b,deepl

# Sólo el ruso, con las pasadas y el informe en otro sitio
uv run translate --bench --model gemma-12b-qat,deepl ../bench/ru-RU.blank.xlf -o ../../../../bench-ru
```

Sin fichero de entrada coge todos los `*.blank.xlf` de este directorio, y de cada uno saca su
referencia quitándole el `.blank`. Lo que se le da al modelo es **siempre el `.blank.xlf`**, nunca
el otro: una unidad sólo está pendiente cuando su `<target>` está vacío, así que el banco con la
traducción buena dentro no tiene nada que traducir, y su memoria de traducción se sembraría además
con las respuestas.

Cada pasada queda como un XLIFF normal en `bench-runs/`, así que se puede volver sobre ella a mano
para un corte que el informe no traiga:

```sh
# La tabla, contra la traducción buena de este directorio
uv run translate bench-runs/ru-RU.*.xlf --compare --reference ../bench/ru-RU.xlf --worst 20

# Sólo las ramas de ICU
uv run translate bench-runs/ru-RU.*.xlf --compare --reference ../bench/ru-RU.xlf --scope bench-icu
```

La puntuación cruza por identificador de unidad, así que la referencia y las pasadas tienen que
salir de la misma generación del banco: si se regenera entre una pasada y la comparación, las
unidades que hayan cambiado de origen se quedan fuera y la columna `missing` las cuenta.

Una pasada cuyo fichero ya está completo no se vuelve a traducir, de modo que añadir un modelo más
tarde es el mismo comando con un alias más: sólo corre lo que falta. Lo que costó cada pasada queda
en un `.json` al lado de su XLIFF, así que **volver a lanzar un banco terminado rehace el informe
entero, tabla de velocidad incluida, sin cargar ningún modelo**. Para repetir una pasada se borran
sus dos ficheros.

## Cuando el español cambie

Cada unidad lleva su `srcHash` en el `.xlf`, igual que en una exportación normal. Si alguien toca
una de estas cadenas en `es-ES.json`, al regenerar el banco el hash cambia y la traducción buena
que hay en `gold/` pasa a ser la de otra frase. `build.mjs` no puede detectarlo solo —no guarda el
hash anterior—, así que la regla es a mano: **quien cambie una cadena que esté en `bench.json`
revisa su entrada en `gold/`**. Son treinta y dos claves; `bench.json` las lista todas.
