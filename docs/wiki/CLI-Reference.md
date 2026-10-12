# CLI Reference

The `@printsync/cli` package exposes the `printsync` binary (Commander). Every command is also
re-exported as a root `package.json` script for convenience.

## Root scripts

| Script | Command |
|---|---|
| `pnpm ads:create` | `pnpm --filter @printsync/cli ads:create` |
| `pnpm ads:daily` | `pnpm --filter @printsync/cli ads:daily` |
| `pnpm campaign:create` | `pnpm --filter @printsync/cli campaign:create` |
| `pnpm film:create` | `pnpm --filter @printsync/cli film:create` |
| `pnpm poster:create` | `pnpm --filter @printsync/cli poster:create` |
| `pnpm social:create` | `pnpm --filter @printsync/cli social:create` |
| `pnpm creative:judge` | `pnpm --filter @printsync/cli creative:judge` |

> The CLI runs from the compiled output (`dist/index.js`), so run `pnpm build` first.

## Commands

### `ads:create`

Create a new advert from a creative brief. Generates concepts, scores them, prints the top three,
and develops a treatment for the winner.

```bash
pnpm ads:create --service "large-format-printing"
```

| Flag | Description |
|---|---|
| `-s, --service <service>` | Service to advertise (default `custom-print-solutions`) |
| `-f, --formats <formats>` | Output formats, comma-separated (default `16:9,9:16,1:1`) |
| `-v, --voice <mode>` | Voice mode: `voiceover` \| `typography` \| `music` \| `dialogue` \| `hybrid` (default `VOICEOVER`) |
| `-m, --mode <mode>` | Creative mode (default `CINEMATIC_BRAND_FILM`) |

### `ads:daily`

Generate today's advert automatically via the V2 creative engine. A day-of-week rotation picks the
mode, then the pipeline runs fatigue analysis, opportunity detection, concept seeding, generation,
anti-generic analysis, judging, diversity analysis, top-3 selection, rework, winner selection, brief
creation, and memory save.

```bash
pnpm ads:daily
```

| Flag | Description |
|---|---|
| `-b, --brand <brand>` | Brand name (default `printsync`) |
| `-f, --formats <formats>` | Output formats, comma-separated |

**Daily rotation** (by weekday, 0 = Sunday):

| Day | Mode | Label |
|---|---|---|
| 0 | `CINEMATIC_BRAND_FILM` | Premium Brand Statement |
| 1 | `SERVICE_AD` | Product/Service Advert |
| 2 | `EDUCATIONAL_AD` | Educational Advert |
| 3 | `TYPOGRAPHIC_FILM` | Brand Film |
| 4 | `HUMOR_AD` | Funny Corporate Advert |
| 5 | `DETECTIVE_AD` | Detective Advert |
| 6 | `VFX_EXPERIMENT` | Visual Experiment |

### `campaign:create`

Create a full campaign (multiple episodes around a name/service).

```bash
pnpm campaign:create --name "Print Has Power" --service "branding"
```

| Flag | Description |
|---|---|
| `-n, --name <name>` | Campaign name |
| `-s, --service <service>` | Primary service |
| `-e, --episodes <count>` | Number of episodes (default `5`) |

### `film:create`

Create a brand film.

```bash
pnpm film:create --duration 30 --style cinematic
```

| Flag | Description |
|---|---|
| `-d, --duration <seconds>` | Duration in seconds (default `30`) |
| `-s, --style <style>` | Film style |
| `-v, --voice <mode>` | Voice mode |

### `poster:create`

Create a motion-designed poster — an animated key visual whose still frames are exported for print.

```bash
pnpm poster:create --size A2 --title "BIG IDEAS"
```

| Flag | Description |
|---|---|
| `-s, --size <size>` | `A4` \| `A3` \| `A2` \| `A1` (default `A2`) |
| `-t, --title <title>` | Poster title |

### `social:create`

Create animated social/story content (motion-designed, never a static image).

```bash
pnpm social:create --platform instagram --format 1:1
```

| Flag | Description |
|---|---|
| `-p, --platform <platform>` | `instagram` \| `tiktok` \| `linkedin` |
| `-f, --format <format>` | `1:1` \| `4:5` \| `9:16` |

### `creative:judge`

Judge an existing concept or campaign against the 10-dimension rubric.

```bash
pnpm creative:judge --file concepts/my-concept.json
```

| Flag | Description |
|---|---|
| `-c, --concept <id>` | Concept ID to judge |
| `-f, --file <file>` | Concept file to judge |

## Banner

Every invocation prints a banner before parsing:

```
VIRTUE STUDIO
Premium visual storytelling. Precision in motion.
```

> Note: the string currently hard-coded in `packages/cli/src/index.ts` still reads
> `PRINTSYNC CREATIVE OS` / `Precision in motion. Ideas becoming physical impact.` The banner
> predates the Virtue Studio name and should be updated.

See [Creative System](Creative-System) for what the judge and engines actually do.
