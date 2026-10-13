# Environment maps (HDRI)

These are the image-based lighting environments the renderer uses. They are
Radiance (`.hdr`) equirectangular skies, loaded through drei's `<Environment>`
and used **only** as image-based lighting (`background={false}`) — the visible
sky is still the procedural dome in `src/models/city/cityArtwork.ts`, which can
place a moon at the right azimuth or a sun where the palette puts it.

| File | Used for | Source |
| --- | --- | --- |
| `pedestrian_overpass_1k.hdr` | `timeOfDay: 'night'` | Poly Haven, via the three.js examples |
| `venice_sunset_1k.hdr` | `timeOfDay: 'dusk'` | Poly Haven, via the three.js examples |
| `spruit_sunrise_1k.hdr` | `timeOfDay: 'day'` | Poly Haven, via the three.js examples |

All three are **CC0** (public domain) — Poly Haven releases every HDRI under CC0,
and they are redistributed inside the three.js repository at
`examples/textures/equirectangular/`.

## Why ship them instead of downloading at render time

A render must be reproducible and must not depend on a network round trip. The
files are 1k resolution (~1.5 MB each), which is ample for ambient light and
reflections on glass and metal at the scale the city is shot, and small enough
to live in the repository.

## Swapping one out

Drop any equirectangular `.hdr` or `.exr` in this folder and point
`HDRI` in `src/models/city/CityEnvironment.tsx` at it. `.exr` needs the
`EXRLoader` extensions hint; `.hdr` works as-is.
