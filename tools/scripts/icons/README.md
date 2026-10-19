# icons

Generates the app's icon set, `apps/web/public/svg/icon/*.svg`, from parametric geometry. Every
icon is built from primitives (circles, rectangles, capsules, arcs), combined with boolean
operations and then rounded, so they all share the same stroke, gap and corner radius. The output
is a single `<path>` per file with integer coordinates.

The generated files are artifacts: change the definition and regenerate, never edit the SVG.
`training.svg` is the app logo, drawn by hand, and the generator never touches it.

## Running it

```sh
pnpm svg:icons                       # every icon
pnpm svg:icons resign flip-board     # only these
pnpm svg:icons --preview             # also a PNG contact sheet of the whole folder (in the OS tmp dir)
pnpm svg:icons --preview=sheet.png   # same, written where you say
```

It warns when a non-square icon is missing from `ASPECT_RATIOS` in
`apps/web/src/app/component/svg/svg.component.ts`, which is what tells `<app-svg>` how wide to draw
it. Square icons need no entry.

## Files

- `icons.mjs` — the definitions and the shared style. `ICONS` maps each file name to its viewBox
  size and a `draw()` that returns a paper.js shape.
- `geometry.mjs` — primitives (`circle`, `rect`, `polygon`, `capsule`, `line`, `arc`,
  `arrowHead`…) and boolean helpers (`union`, `subtract`, `intersect`, `mirror`, `rotate`).
- `round.mjs` — `round(shape, radius, inner)` fillets every corner: `radius` for the convex ones,
  `inner` for the concave ones. Very acute corners come out as small hooks, so shapes are drawn to
  meet at angles near 90° instead.
- `path-data.mjs` — serializes a shape to compact path data.
- `preview.mjs` — the PNG contact sheet, rendered with resvg.

## Style

All coordinates are on a grid 512 units tall, whatever the width, so a stroke is equally thick in
every icon. The constants at the top of `icons.mjs` drive the whole set:

| Constant | Value | What it is                                                       |
| -------- | ----- | ---------------------------------------------------------------- |
| `STROKE` | 64    | Line weight of strokes (chevrons, close, bars, arcs)             |
| `GAP`    | 32    | Negative space between overlapping parts, after the logo's bands |
| `RADIUS` | 28    | Convex corner radius                                             |
| `INNER`  | 16    | Concave corner radius                                            |

## Adding an icon

1. Write a `draw()` in `icons.mjs` and register it in `ICONS` as `icon(width, 512, draw)`. Keep
   the height at 512 and pick the width that fits the shape.
2. `pnpm svg:icons <name> --preview` and look at the sheet.
3. If it is not square, add it to `ASPECT_RATIOS`.

paper.js is loaded with a stub `self` global, because inside this repo it would otherwise find
jsdom, try to create a real canvas and fail.
