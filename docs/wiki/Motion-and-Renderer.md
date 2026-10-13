# Motion & Renderer

This page documents the motion-first half of Virtue Studio: the
`@printsync/motion-engine` specification layer and the `@printsync/renderer`
Remotion app that turns that specification into pixels.

The dividing line is deliberate:

- **`@printsync/motion-engine`** is pure, deterministic TypeScript. It owns every
  number: sizes in millimetres, camera poses, animation transforms, palette data,
  and the procedural generation of cities and printed artwork. It renders nothing
  and has no dependency on React, Remotion, or Three.js.
- **`@printsync/renderer`** is the presentation layer. It reads the specification
  and draws it with React Three Fiber, Remotion, and Canvas 2D. It makes no design
  decisions of its own.

That split is what makes renders reproducible: given the same brief and the same
seed, the engine produces the same numbers, so the renderer produces the same
frames. A still rendered twice from the same props is byte-identical.

---

## Camera vocabulary

Six named paths describe any camera move the system makes. The vocabulary is
declared once, in `packages/motion-engine/src/camera.ts`:

```ts
export const CAMERA_PATHS = [
  'turntable', 'orbit', 'dolly', 'hero', 'showcase', 'none',
] as const;
```

A path is resolved to a concrete `CameraPose` (a `position` and a `lookAt`) plus a
`worldSpin` factor that tells the composition how far to rotate the subject
instead. Two resolvers share the one vocabulary:

| Resolver | Scale | Used by |
|---|---|---|
| `resolveCameraPlan(path, progress, radius)` | metres from a product on a turntable | `PrintSyncProductLine` |
| `resolveCityCameraPlan(path, progress, extent, subjects?)` | hundreds of metres across a city | `PrintSyncLivingCity` |

`worldSpin` is what lets `turntable` mean "rotate the object" in the product
composition and "orbit the city" in the city composition, without inventing new
path names or new schema.

The renderer only ever receives the resolved pose. `models/CameraRig.tsx` takes a
`pose` prop and nothing else, so the rig is scene-agnostic — both compositions
compute their own plan and hand over the result.

### The `showcase` edit

`dolly` is the travelling pass: it rides the left-hand lane divider down the whole
boulevard at driver eye height and cranes up after the midpoint. `showcase` is the
same pass cut into a shot list, so the film can push in tight on the products it is
actually selling:

```ts
export const SHOWCASE_SHOTS = [
  { kind: 'street',    from: 0.00, to: 0.30 },
  { kind: 'shopfront', from: 0.30, to: 0.52 },
  { kind: 'billboard', from: 0.52, to: 0.68 },
  { kind: 'sign',      from: 0.68, to: 0.84 },
  { kind: 'skyline',   from: 0.84, to: 1.00 },
] as const;
```

The first shot *is* the dolly pass (`boulevardPose`), so the film opens on the same
travelling move; the last is a crane to the skyline. The three close-ups are
**hard cuts** — the pose at the end of one shot is nowhere near the pose at the
start of the next — and each is a real push-in framed off the printed face:

- **Lens maths.** `fov` is 52° vertical, the frame is 16:9, so the visible width at
  distance `d` is `1.734 · d` and `frameDistance(visibleWidth)` inverts that.
  `SUBJECT_FRAMING` gives each kind a start/end visible width plus a lift, aim and
  slide, so the move pushes up to the product and the aim drifts across its face.
- **Square-on.** `subjectPose` puts the lens on the face's outward normal —
  `faceCentre + normal · distance + tangent · slide + up · lift` — and looks at
  `faceCentre + up · (aim · height)`, without ever spinning the world round. One
  frame will not be corrected by another, so the composition is exact at any frame.
- **Never a dead pose.** The fourth argument to `resolveCityCameraPlan` is the
  resolved shot subjects. Missing a subject (say no kerbside digital screen clears
  the parking bays) the shot falls back to `boulevardPose` at the same progress, so
  the film always has a camera.
- **Clearance is geometry, not luck.** A close-up puts the lens between the parking
  bays and the sign line, so the billboard and sign subjects are chosen from
  candidates with `SHOT_PARKING_CLEARANCE_M` (1.5 m measured to the *body* of the
  nearest same-side parked vehicle, not its centre) — a bus is 11.5 m long and the
  shot drifts along the face. The shopfront close-up rides at fascia height above
  the traffic, so it needs no kerbside gap.

---

## The print-item catalogue

`packages/motion-engine/src/print-items.ts` is the single source of truth for
every physical printed product the system can model. Each `PrintItemSpec` carries
**real millimetre dimensions** — a shipping carton really is 400 × 300 × 250 mm —
and one unit scale converts them to scene units:

```ts
export const SCENE_UNITS_PER_MM = 0.001; // 1 mm = 0.001 scene units
export function toSceneUnits(millimetres: number): number;
```

Every item is grounded at `y = 0` and faces `+Z`, so items can be placed side by
side without per-item offset maths. The catalogue covers five categories:

| Category | Examples |
|---|---|
| `flat` | business card, flyer, poster, folded leaflet |
| `label` | bottle label (wraps a cylinder) |
| `box` | folding carton (with flaps), rigid box |
| `container` | bottle, jar, pouch, tube, roll-up banner |
| `banner` | roll-up banner stand |

Fidelity rules that are centralised as pure, tested helpers rather than repeated
in JSX:

- `dimensions.height` is the **overall envelope**, including closures — so a bottle
  spec's height includes its cap, and `printItemBodyHeight(spec)` subtracts it.
- `printItemDecalRect(spec)` and `printItemWrapBand(spec)` compute exactly where a
  front decal or a wrap-around band lands on the item, including the roll-up
  banner's 1045 mm decal centre.
- `printItemBevelMm(spec)` derives bevel from corner radius so edges stay consistent.
- `groundAssembly` grounds multi-part items (stand + graphic, body + cap) as one unit.
- `revolveRadiusAt(profile, t)` samples a lathe profile, used for bottles, jars, tubes.

Nothing about an item is hand-placed at the call site: `PRINT_ITEMS` is the only
list, and `PRINT_ITEMS_HERO_IDS` names the six-item hero set used when a render
input does not name its own items.

---

## Printed artwork

Items have to read as *finished print*, not as coloured plastic. Artwork is drawn
procedurally onto a `CanvasTexture` in `packages/motion-engine/src/artwork.ts` and
the renderer's `models/artwork.ts` painters:

- `buildArtworkSpec(itemId, brand, ...)` produces an `ArtworkSpec` with a layout
  `variant` (`editorial` | `banner` | `monogram` | `grid`) and a `shape`
  (`rect` | `circle` | `band`).
- Both the variant and the layout are derived from an FNV-1a hash of the item id, so
  a given item always gets the same design and the same text fits, deterministically.
- The painting helpers (`drawWordmark`, `drawLabel`, `drawBarcode`, `wrapText`,
  `roundRect`) give real print furniture: a wordmark, a label block, a barcode, a
  wrap-around band, bleed-safe margins.

`ArtworkSpec.shape` is what lets a printed decal follow a circular label or a band
around a curved surface instead of being stretched across it.

---

## Animation library

`packages/motion-engine/src/choreography.ts` provides frame-addressable animation:
a pure function that returns the transform for *exactly one frame*, so any frame
can be rendered independently and out of order (essential for parallel and
distributed rendering).

```ts
export function animatePrintObject(
  spec: PrintItemSpec,
  animation: PrintObjectAnimation,
  frame: number,
  fps: number,
  phase?: number,
): Transform;
```

There are eight animations (hero items are mapped to a fixed subset via
`PRINT_ITEMS_HERO_ANIMATIONS`), and `resolveChoreography(...)` applies per-item
overrides. Because the function is pure and `Transform` is plain data, the
renderer simply applies `position` / `rotation` / `scale` / `opacity` to the item
group each frame — there is no animation state to synchronise.

---

## The living city

`PrintSyncLivingCity` is a night drive through a working city that advertises
PrintSync. It is not a background plate: every building, sign, and screen is
generated to a real specification.

### Scene generation (`packages/motion-engine/src/city.ts`)

```ts
generateCityLayout({ seed, density, timeOfDay }) // → buildings, roads, lights, billboards, signs
generateCityRoute({ seed })                      // → a 96-point road route
sampleCityRoute(route, t)                        // → position at fraction t (for the head marker)
cityPalette(timeOfDay)                           // → presentation palette (pure data)
```

The layout is deterministic from `seed` and scales from a set of real-metre
constants: `CITY_EXTENT_M` (120), `CITY_BOULEVARD_HALF_WIDTH` (12),
`CITY_SIDEWALK_WIDTH` (4), `CITY_BUILDING_GAP` (3), `CITY_LOT_DEPTH` (16).
Buildings, street lights, billboards, and signs are all placed along the boulevard
at collision-free slots, so denser seeds add more city without overlaps.

### Road signage (`signage.ts`)

Nine signs from the UK TSRGD family (`safety`, `regulation`, `wayfinding`,
`information`) with real face dimensions and real mounting heights, plus
`roadSignOutlinePoints(kind)` — normalised polygon outlines used by **both** the
physical geometry in the renderer and the printed legend, so a triangle sign's
panel and its artwork can never disagree about shape.

### Out-of-home (`ooh.ts`)

Seven real formats — 6-sheet, 48-sheet, 96-sheet, 4-sheet portrait, roadside
digital, mall digital, and a digital spectacular — with true dimensions (a 96-sheet
really is 12.192 m wide). Paper formats are printed once from `buildOohArtworkSpec`
and read as floodlit or backlit (lightbox); digital formats rotate `OOH_PLAYLIST`
and read as self-lit LED.

### Traffic and the public realm (`vehicles.ts`, `street.ts`)

Traffic is deterministic and *frame-addressable*: a seed fixes which vehicles exist,
where they start and how fast they move, and the renderer only ever asks
`vehiclePoseAt(vehicle, seconds)` for "where is this vehicle right now", so frames
can be drawn independently and out of order. Vehicles are modelled at real
dimensions — a bus really is 11.5 m long, a truck 3.35 m tall — which is also what
makes the close-up clearance rules meaningful.

The street furniture (bins, benches, planters, hydrants, bollards, signals, a bus
shelter) is generated by `generateCityProps({ seed, density })`, again as pure data
with real sizes, so the public realm is as deterministic as the buildings.

### Shopfronts and shop interiors (`shopfronts.ts`)

Buildings of any non-`tower` style may open their ground floor: the mass is lifted
to `shopfront.height`, a rear filler closes the ground floor behind the shop, and a
`CityShopfront` fills the opening. The storefront sits in the building's
**street-facing wall plane**, and its local frame is documented so the renderer
never guesses: **+Z faces the street, +X runs along it, the interior occupies
`z ∈ [-depth, 0]`**.

Everything a real shopfront is made of is printed and generated from a
`CityShopfront` — fascia, window vinyl, awning, A-board, and the branded interior
behind the glass. Interiors are lit by the *emissive print* plus an additive
light-pool on the pavement, deliberately with **no per-shop point lights**: ten shops
would otherwise mean ten more shadow-casting lights for no visual gain.

Exactly one shop is PrintSync's own, using the real roundel and `brand.primary`; the
other nine are fictional local trades. The PrintSync shop is not "the first one
generated" — it is chosen geometrically by `printSyncBuildingId()` as the left-hand
tradable frontage nearest `SHOPFRONT_HERO_Z`, so it always lands on the camera's
route no matter how the seed shuffles the rest.

### Renderer components (`apps/renderer/src/models/city/`)

| Component | Responsibility |
|---|---|
| `CityEnvironment` | Sky dome, fog, ambient/hemisphere/sun lights, ground |
| `Building` | Mass with a window grid mapped per-face (windows never stretch), parapet, rooftop plant |
| `Shopfront` | Opened ground floor: fascia, window vinyl, awning, A-board, branded interior |
| `Street` | Carriageway with painted lane markings, kerbs, pavements |
| `Crossing` | Zebra crossing painted on the tarmac |
| `StreetLight` | Column, arm, emissive luminaire, additive glow and ground light pool |
| `StreetProp` | Bins, benches, planters, hydrants, bollards, signals, bus shelter |
| `RoadSign` | Extruded panel in its exact outline + printed, retro-reflective face |
| `Billboard` | Frame, panel, mount (rooftop/facade/kerb), paper or LED surface |
| `Vehicle` | Car, taxi, van, bus, truck, in lane or parked |
| `RouteLine` | The self-drawing route ribbon and its head marker |
| `cityArtwork.ts` | All Canvas 2D painters for the above |

One detail worth calling out: the building facade is split into two textures — an
albedo map and a separate emissive map. That is what lets one building look right
at midnight (near-black cladding, warm glowing windows) and at midday (light
concrete, cold glass) without the night-dark cladding ever multiplying the
daytime building into a silhouette.

Two renderer details worth calling out because they are invisible until you look
closely:

- **The billboard frame is recessed.** The bezel box's front face sits 2 cm *behind*
  the panel plane. Put the two flush and the coplanar surfaces z-fight, and — because
  the frame is drawn after the panel at equal depth — the frame wins and the artwork
  disappears. In a wide shot that hides itself; in a close-up it does not.
- **Light is image-based.** `CityEnvironment` loads a real CC0 Poly Haven
  equirectangular `.hdr` (shipped in `apps/renderer/public/hdri/`, ~1.5 MB each) as
  `Environment files=…` with `background={false}` — used purely as image-based
  lighting, so the visible sky stays the procedural dome that matches the palette.
  The file is chosen per time of day. Tone mapping is left to R3F (`ACESFilmicToneMapping`
  + `SRGBColorSpace`); the realism work goes into the content.

### Composition (`apps/renderer/src/compositions/PrintSyncLivingCity.tsx`)

The composition resolves its inputs through `resolveCityInputs(props)`, derives the
camera pose from `resolveCityCameraPlan(cameraPath, progress, extent, shotSubjects)`,
and draws the scene, lit by point lights anchored to the real street lamps so pools
of light line up with the fittings. Digital billboards rotate the playlist on a
fixed `AD_SECONDS` hold, so the advert on a screen is also a pure function of the
frame.

---

## Render input contract

`packages/common/src/render-input.ts` is the validated boundary between the
orchestrator and the renderer:

```ts
export const CompositionIdSchema = z.enum([
  'PrintSyncSignatureFilm',
  'PrintSyncProductLine',
  'PrintSyncBrandFilm',
  'PrintSyncLivingCity',
]);

export const CityInputsSchema = z.object({
  seed: z.string().min(1).default('printsync-city-01'),
  timeOfDay: z.enum(['night', 'dusk', 'day']).default('night'),
  density: z.number().positive().default(1),
  route: z.boolean().default(true),
});
```

`packages/production-orchestrator/src/index.ts` produces these inputs:

- `buildRenderInputs(brief)` → `PrintSyncProductLine`
- `buildCityRenderInputs(brief, { seed?, timeOfDay? })` → `PrintSyncLivingCity`,
  with a seed derived from the brief id by default.

Everything the city needs (layout, route, signage, out-of-home, palette) is
generated inside the renderer from these few values, so nothing about the street is
hard-coded in the orchestrator.

---

## Rendering

`apps/renderer` sits outside the Turborepo `build` pipeline, so it is validated
directly. Because it imports the engines from their built `dist`, build the
workspace first after any engine change.

```bash
pnpm build                                             # build the engines
pnpm --filter @printsync/renderer run typecheck         # type-check the renderer
pnpm --filter @printsync/renderer run dev               # Remotion Studio (interactive)
```

Still frames and video, driven by a props file (PowerShell mangles inline JSON, so
always pass a file):

```bash
pnpm --filter @printsync/renderer exec remotion still src/index.ts PrintSyncLivingCity \
  out.png --frame=300 --props=props.json

pnpm --filter @printsync/renderer exec remotion render src/index.ts PrintSyncLivingCity \
  out.mp4 --frames=0-1199 --codec=h264 --crf=16 --pixel-format=yuv420p --props=props.json
```

A props file is any partial of `CityInputs` plus the presentation strings the
composition reads:

```json
{
  "seed": "printsync-city-01",
  "timeOfDay": "night",
  "density": 1.2,
  "route": true,
  "cameraPath": "showcase",
  "title": "PrintSync City",
  "tagline": "Every surface, printed to spec."
}
```

Renders can also be farmed out. `@printsync/render-farm` plans the settings, drives
`@remotion/lambda` when AWS is available, and shells out to FFmpeg for delivery
formats — see [Enterprise Rendering](Enterprise-Rendering).

---

## Principles

1. **Specification before pixels** — engines decide, the renderer draws.
2. **Frame-addressable** — every animation can be evaluated at any frame, in any order.
3. **Deterministic** — a seed and a brief fix the entire output; identical inputs give identical bytes.
4. **One vocabulary, many scales** — the same camera paths and the same catalogue philosophy drive a 90 mm business card and a 12 m billboard.
5. **Millimetre-true** — print products are modelled and generated at real sizes, because they are real products.
6. **Show the product** — a travelling pass sets the scene, but the film earns its keep by cutting in close on the printed work: the shopfront, the screen, the safety sign.

See also: [Architecture](Architecture) · [Packages & Engines](Packages-and-Engines) · [Creative System](Creative-System) · [Enterprise Rendering](Enterprise-Rendering) · [Roadmap & Status](Roadmap)
