# bench — el banco de pruebas del traductor

El banco v2 mide a los modelos en las mismas condiciones en que traducirán el catálogo de verdad,
y los compara de forma automática, sin que nadie tenga que leer los idiomas. El banco anterior
está en [`legacy/`](legacy/README.md), intacto, con sus propias pasadas en
`translate/bench-runs/legacy/`.

No es una traducción de producción. Nada de aquí entra en `apps/web/src/app/i18n/*.json`, y
**`pnpm i18n:import` no debe apuntar nunca a este directorio**.

## Los ficheros

| Fichero              | Qué es                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `snapshot.json`      | Los textos congelados: 135 claves del catálogo del 20/10/2026, en tramos contiguos          |
| `build.mjs`          | Genera un `<lang>.blank.xlf` por idioma con el código real de la exportación                |
| `<lang>.blank.xlf`   | Lo que se le da al modelo. **Generado**                                                     |
| `expect/<lang>.json` | Lo que se espera de cada unidad: referencias, aserciones y excepciones a las comprobaciones |

```sh
node tools/scripts/i18n/bench/build.mjs
```

Escribe los cinco `.blank.xlf` y dice, por idioma, cuántas unidades salen y su **huella**: un hash
del fichero entero. Si la huella cambia es que ha cambiado lo que ve el modelo.

## Por qué así

**Los textos están congelados, las instrucciones no.** `snapshot.json` guarda los textos
españoles, sus ULID y sus parámetros tal como estaban el día de la instantánea, así que el
catálogo puede seguir cambiando sin romper ninguna comparación. El contexto —`app.md`, las notas
de cada scope, el glosario— se lee del repositorio cada vez que se genera el banco, porque es justo
lo que se quiere mejorar: un cambio en las instrucciones se mide regenerando el banco y repitiendo
la pasada. Si una clave de la instantánea desaparece del catálogo, `build.mjs` lo avisa, porque su
nota de contexto se habrá perdido con ella.

**Es la exportación de verdad, no una imitación.** `build.mjs` monta la instantánea como un
catálogo en miniatura en un directorio temporal y la pasa por `buildExport`, el mismo código que
`pnpm i18n:export --blank`. Las notas, el orden de las claves y la expansión de plurales y
géneros son las de producción.

**Tramos contiguos, no unidades sueltas.** El traductor reparte las unidades en lotes por orden
del catálogo, así que lo que rodea a una unidad cambia su prompt: el glosario filtrado, las reglas
que tocan y el contexto compartido. Elegir claves sueltas ponía en un mismo lote textos que en
producción nunca van juntos. Los tramos de cada scope están en `snapshot.json`, en `windows`.

**Las claves ICU están escritas como las tendrá el catálogo.** Hoy el catálogo no tiene ninguna,
pero la decisión del modelo se toma para el catálogo de mañana. Catorce claves de la instantánea
llevan su versión ICU (`catalogue` guarda la cadena plana original):

- **Plurales con `#`**: `PENDING_SYNC_MESSAGE`, `PENDING_SYNC_REJECTED`, `PASSWORD_MIN_LENGTH`,
  `ACTIVITY_TOTAL`, `ACTIVITY_DAY_DETAIL`, `IMPORTED`, `SYNC_REJECTED`, `SYNC_ROWS`,
  `SYNC_STALE` y `SET_ALREADY_FIXED`. En ruso cada una se abre en cuatro unidades.
- **Género de quien usa la aplicación**: `PURPOSE_TITLE` (que en español sí varía:
  «Bienvenido», «Bienvenida», «Te damos la bienvenida») y `RESIGNED`, `GAVE_UP_WATCHING` y
  `GAVE_UP_LINE`, cuyas tres ramas españolas son idénticas porque el español no marca género en
  «te has rendido». La variación la pone el idioma de destino.
- `IMPORTED_WITH_SKIPPED` se queda plana: con dos plurales serían 16 formas en ruso, y el
  catálogo pone el tope en 12.

## Cómo se puntúa

No hay nadie que pueda leer los cinco idiomas, así que cada unidad pasa por tres capas que no
necesitan a nadie:

1. **Comprobaciones automáticas**, iguales para todos los idiomas: marcadores (`markers`), que
   también cuenta los que el modelo escribe a mano —un `{pending}` copiado de la nota de contexto
   en un texto que no lo lleva—, respuesta vacía (`empty`), copia del original (`untranslated`),
   alfabeto equivocado (`script`), glosario (`glossary`), nombres que no se traducen (`keep`),
   separador « · » (`separator`), mayúscula inicial (`case`, salvo cuando el original o la
   respuesta empiezan por un marcador, porque entonces la mayúscula la pone su valor), puntuación
   final (`ending`), «…» (`ellipsis`), comillas del idioma (`quotes`), longitud (`length`), tokens
   internos del modelo (`tokens`, como el `<audio|>` que Gemma 4 suelta en catalán), «¿» y «¡»
   fuera del español (`inverted`) y
   ejemplo copiado (`sample`): las notas de plural y de género enseñan la gramática con manzanas y
   libros (`translate/translator/samples.py`), y cualquier rastro de esas palabras en una respuesta
   es un crítico, porque sólo puede venir de la nota. La heurística del traductor que compara las
   formas de una clave no entra: fuera de las unidades que ya tienen aserciones, sólo saltaba donde
   el idioma no marca esa forma («# rejected», «Добро пожаловать», «Tu as abandonné», casi todo el
   hindi), así que sólo añadía falsos positivos. Sigue mandando unidades a revisar, y eso se ve en
   la columna `review`.
2. **Aserciones escritas a mano** en `expect/<lang>.json` (`expected`): lo que tiene que aparecer
   (`has`), lo que no puede aparecer (`not`) y expresiones regulares (`re`). Están sólo donde no
   hay duda posible: la forma del sustantivo de cada plural ruso, el género del verbo en pasado,
   el adjetivo que concuerda con la pieza, los casos que un marcador no puede llevar, el
   infinitivo de los botones, errores de significado ya vistos («ежедневно» por «al día»). Lo que
   es preferible pero no un error, como el orden «чёрный слон» frente a «слон чёрный», va en
   `prefer` y cuenta como leve (`style`).
3. **chrF contra una o varias referencias** (`ref`), escritas para este banco sin que nadie las
   haya revisado. Se compara con la más parecida, así que una paráfrasis aceptable no penaliza
   si está en la lista. Antes de puntuar se igualan ё/е y las comillas, y los marcadores cuentan
   como un solo carácter.

Cada fallo tiene una gravedad: **crítico** (marcador perdido, respuesta vacía, aserción no
cumplida), **grave** (glosario, nombre traducido, alfabeto, separador) o **leve** (mayúscula,
puntuación, comillas, longitud, `prefer`). Las aserciones son críticas salvo que digan
`"severity": "major"`.

### Escribir una expectativa

```json
"CommonI18n.PIECE_BLACK_QUEEN": {
	"axis": "concordancia entre claves",
	"ref": ["чёрный ферзь"],
	"has": ["черный"],
	"prefer": ["черный ферзь"]
},
"TrainingI18n.GAVE_UP_WATCHING#gender:other": {
	"axis": "género de quien usa",
	"not": ["сдался", "сдалась", "ты сдал"]
},
"CommonI18n.LOG_OUT_ANYWAY": { "allow": ["glossary"] }
```

- La clave es la constante y el nombre (`CommonI18n.PIECE_BLACK_QUEEN`) más el sufijo de la forma
  si la hay (`#plural:few`, `#gender:other`).
- `has`, `not`, `re` y `prefer` se comparan con la respuesta **normalizada**: en minúsculas, con ё
  como е y los espacios finos como espacios. Se escriben así.
- Una aserción comprueba una sola cosa. En el ejemplo, `has` exige la concordancia (ферзь es
  masculino aunque la dama sea femenina) y `prefer` el orden natural: «ферзь черный» concuerda y
  sólo pierde un leve, «ферзь черная» es un crítico.
- Los marcadores se escriben como en el catálogo: `{piece}`, `{count}`, y `#` dentro de un plural.
- `allow` desactiva una comprobación automática en esa unidad cuando es un falso positivo
  sabido: «Al cerrar sesión» no lleva «сессия», «Original» se escribe igual en inglés, la
  «torre negra» catalana es la misma que la española.
- `axis` agrupa las aserciones en la tabla «Expectations met, by axis» del informe.
- El bloque `lang` dice qué comillas y qué puntos finales vale cada idioma (`।` en hindi).

**La regla de oro es la precisión**: una aserción que falla con una traducción correcta envenena
el banco. Ante la duda, una referencia más y ninguna aserción.

## Cómo se usa

```sh
cd tools/scripts/i18n/translate

# Los cinco idiomas, dos modelos
uv run translate --bench --model gemma4-e4b-optiq,qwen35-9b

# Sólo ruso e inglés, que son los que tienen referencias completas
uv run translate --bench --model gemma4-e4b-optiq ../bench/ru-RU.blank.xlf ../bench/en-GB.blank.xlf
```

Las pasadas quedan en `bench-runs/` y el informe en `bench-runs/comparison.md`. El informe ordena
los modelos por críticos, luego por aserciones no cumplidas, luego por graves y luego por chrF, y
trae, por idioma:

- **La tabla de calidad**: unidades con algún fallo crítico, grave o leve; porcentaje de unidades
  sin ningún fallo; aserciones cumplidas; claves con formas (plural o género) que cumplen todas sus
  aserciones; chrF medio; y las que el traductor dejó para revisar.
- **El coste**, igual que antes.
- **Los fallos por código**, para ver de qué pie cojea cada modelo.
- **Las aserciones por eje**, que es donde se ve si unas instrucciones nuevas arreglan el plural
  o el género.
- **El cara a cara**, dos veces: para cada par de modelos, en cuántas unidades es mejor uno y en
  cuántas el otro, con la `p` de una prueba de signo. La primera tabla sólo mira lo que saldría
  roto (críticos y aserciones) y es la que decide; la segunda cuenta también graves y leves, así
  que un modelo que pone «слон белый» en diez piezas pierde diez unidades aunque no haya roto
  nada. Con `p` por encima de 0,05 la diferencia puede ser suerte.
- **Las unidades que fallan**, con el original, la referencia y lo que dijo cada modelo con sus
  fallos al lado.

### La columna `prompt`

Cada pasada guarda en su `.json` una huella de los prompts que vio (todos los de primer intento,
tal como se mandan) y otra del código del traductor. El informe la enseña en la columna `prompt`
y avisa en negrita si no todas las filas coinciden: comparar dos modelos que vieron prompts
distintos no mide sólo el modelo. Al cambiar las instrucciones, **un `--output` nuevo por
experimento**:

```sh
uv run translate --bench --model gemma4-e4b-optiq,qwen35-9b -o bench-runs/base
# … se toca app.md o prompting.py, se regenera el banco …
uv run translate --bench --model gemma4-e4b-optiq,qwen35-9b -o bench-runs/ejemplos
```

Un cambio de instrucciones se da por bueno cuando mejora en **los dos** modelos, y en ningún
idioma empeora: así no se ajusta el prompt a la medida de uno solo.

## Cuando haya que congelar otra vez

Cuando el catálogo cambie tanto que el banco ya no se le parezca, se hace un banco v3: otra
instantánea, otro `snapshot.json` con `version: 3`, y las expectativas revisadas. Las pasadas de
una versión no se comparan con las de otra.
