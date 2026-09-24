# Share card

Regenerates `public/og.png` — the image WhatsApp, Viber, Facebook and X show
when someone posts a link to us. For anyone who has never heard of AIsathi it
is the entire first impression, so it is worth keeping honest.

It is built, not painted. The galaxy is the same construction as
`components/HeroGalaxy.tsx`, with every star placed by a real model's price
from `catalogue.json` — which is why the card can quote a model count at all.

```bash
python scripts/og-card/build.py      # -> scripts/og-card/card.html
node scripts/og-card/shoot.mjs scripts/og-card/card.html /tmp/og-2x.png 1200 630
# then downsample to 1200x630 with LANCZOS and save over public/og.png
```

**When the catalogue grows, the card starts lying.** The counts are written into
`build.py` and `catalogue.json` is a snapshot, not a live read. Refresh it from
`/api/v1/models` and re-run before quoting a new number anywhere else.

The render is seeded in `card.js`, so one snapshot always gives the same image.
A share card that reshuffles on every build cannot be reviewed or diffed.

Kept as a full-colour PNG at ~280 KB rather than quantised to ~110 KB: the glow
bands visibly at 256 colours, and dithering to hide that costs more bytes than
the colours save. Nothing on the site loads this file — only link scrapers do.
