import type { StrokeCounts } from "../types";

export function buildFinalPrompt(counts: StrokeCounts, notes: string): string {
  const trimmed = notes.trim();
  const notesBlock = trimmed ? `"${trimmed}"` : "(none)";

  return `You are editing a daytime photograph of a residential yard to show how it will look at night after the specified outdoor lighting is installed. The output must look like a real photograph of the same location at dusk — not a rendering.

IMAGES PROVIDED
  • Image 1 — the daytime photo of the yard, with annotation marks drawn on top by a lighting designer.
  • Image 2 — product photo of the UPLIGHT fixture (bronze spot on a ground spike).
  • Image 3 — product photo of the DOWNLIGHT fixture (matte black cylinder, wall/eave mounted).
  • Image 4 — product photo of the PATHLIGHT fixture (bronze mushroom-cap on a stem, roughly 18 inches tall).

Images 2–4 are there only so you know what the fixture hardware looks like. Match the body, material, and finish when rendering fixtures in the scene. Ignore their backgrounds, studio lighting, and crop.

CORE RULES
1. Preserve Image 1 exactly — same house, architecture, trees, plants, hardscape, water, camera angle, and composition. Do not redesign anything that already exists.
2. Make only two changes: shift the scene to a clear evening after sunset (deep blue sky, no sun, no daytime shadows), and install/turn on the lighting described below.
3. The colored lines and sticker icons in Image 1 are placement instructions, not objects. They must not appear anywhere in the output — render the scene underneath them as it actually exists.

HOW TO READ IMAGE 1
  • BLUE LINE (#3b82f6) → DECK LED strip. Install a continuous hidden warm-white strip along the exact path of the line, following whatever edge it traces (deck fascia, stair riser, railing underside). Only its uniform glow is visible.
  • AMBER LINE (#f59e0b) → PERMANENT architectural lighting. Install recessed warm-white linear lighting along the exact path of the line, following the roofline/fascia/eave/soffit it traces. A clean even wash — no visible bulbs, no string or bistro lights.
  • UPLIGHT STICKER (fixture = Image 2) → one ground-mounted uplight at the exact sticker position, aimed up at the nearest tree, pillar, or wall.
  • DOWNLIGHT STICKER (fixture = Image 3) → one wall/eave-mounted downlight at the exact sticker position, aimed straight down.
  • PATHLIGHT STICKER (fixture = Image 4) → one path fixture planted in the ground at the exact sticker position.

Each sticker = exactly one fixture at that XY. Do not move, merge, duplicate, or redistribute. Each line is the full run of that lighting — follow its geometry.

FIXTURE COUNT FOR THIS YARD
  • Deck LED runs: ${counts.deck}
  • Permanent roofline runs: ${counts.permanent}
  • Uplights: ${counts.uplight}
  • Downlights: ${counts.downlight}
  • Pathlights: ${counts.pathlight}

The fixtures visible in the output must match these counts. Do not light anywhere that is not annotated.

HOW THE LIGHT MUST BEHAVE
All fixtures emit warm white light. Light follows real physics — direction, falloff, and bounce all matter.

  • UPLIGHTS — narrow upward beam. Bright grazing hotspot at the base of the target, revealing bark/stone/siding texture, fading into a soft halo above. Faint stray light catches nearby foliage. Bronze fixture body visible on the ground.
  • DOWNLIGHTS — moderate downward cone. Crisp circular pool on the surface directly below; faint scalloping may show on the wall beneath. No upward spill. Black fixture body visible at the mount point.
  • PATHLIGHTS — fully shielded downward cast. Small circular pool at the fixture base and a soft glow on the underside of the cap. Bronze body stands vertically at the sticker.
  • DECK LED STRIPS — continuous uniform warm glow hugging the traced edge. No individual bulbs, no hotspots. Gentle reflection onto adjacent deck boards and railings.
  • PERMANENT ROOFLINE — soft even warm wash along the traced edge, grazing the fascia/soffit with a gentle halo on the wall below. Clearly architectural, not festive.

Applies to every fixture: intensity drops quickly with distance; subtle warm bounce onto adjacent surfaces; small realistic contact shadows behind fixture bodies; accurate warm reflections on any visible water. Unlit areas stay naturally dark — do not light the whole yard. Overall mood: high-end residential, subtle, elegant. Not theatrical.

INSTALLER NOTES
${notesBlock}

OUTPUT
The edited photograph only — same resolution and framing as Image 1. No text, watermarks, or annotation marks.`;
}
