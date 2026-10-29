# -*- coding: utf-8 -*-
"""Normalise the vendor logos into uniform cards for the pinboard.

The source files arrived at every size, aspect and format — 200x200 to
2770x972, JPEG, PNG, WEBP, some with transparency, some with dark brand
backgrounds. Hanging them raw would give a board of mismatched rectangles.

Each one is:
  1. flattened onto its own background colour, sampled from the corners, so a
     logo that was cut on black stays on black and one cut on white stays on
     white. Guessing a single background for all of them would have punched
     white boxes into the dark marks.
  2. trimmed of that background, so the mark itself sets the size rather than
     whatever padding the file happened to ship with,
  3. re-padded to one aspect with a consistent margin, and
  4. written at 2x for the card it will hang in.

Run:  python scripts/vendor-logos/build.py <source-folder>
"""
import io
import os
import sys

from PIL import Image

# Source filename -> the vendor name `vendorOf()` produces for it. The board
# joins on this, so a vendor absent from the catalogue simply never hangs.
MAP = {
    "open AI.jpeg": "OpenAI",
    "qwen.png": "Qwen",
    "gemini.jpeg": "Google",
    "cladue.jpeg": "Anthropic",
    "mistral.jpeg": "Mistral",
    "z-ai.webp": "Z.ai",
    "deepseek.jpeg": "DeepSeek",
    "llama.png": "Meta",
    "moonshoot.jpeg": "Moonshot",
    "xai.jpeg": "xAI",
    "minimax.jpeg": "MiniMax",
    "Nvidia-Logo-PNG.png": "NVIDIA",
    "tensent.jpeg": "Tencent",
    "Aion.jpeg": "Aion Labs",
    "Cohere.webp": "Cohere",
    "t_500x300.jpeg": "Amazon",
    "OpenRouter.DiXoyepE.jpg": "OpenRouter",
    "seed.jpg": "ByteDance Seed",
}

CARD_W, CARD_H = 224, 116          # 2x the 112x58 the board draws
MARGIN = 0.12                      # breathing room inside the card
TOL = 18                           # background match tolerance, 0-255


def slug(name):
    out = []
    for ch in name.lower():
        out.append(ch if ch.isalnum() else "-")
    s = "".join(out)
    while "--" in s:
        s = s.replace("--", "-")
    return s.strip("-")


def background(im):
    """The colour the logo was cut on, taken from the corners."""
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    # ANY transparent corner means the file was cut to sit on whatever is
    # behind it, so it belongs on paper white. Requiring all four was too
    # strict: Z.ai has three transparent corners and one opaque black one,
    # which made its dark grey mark a black rectangle on a black card.
    if any(c[3] <= 128 for c in corners):
        return (255, 255, 255)
    opaque = list(corners)
    # The most common corner wins; a tie falls to the top-left.
    best, seen = opaque[0], 0
    for c in opaque:
        n = sum(1 for o in opaque if all(abs(o[i] - c[i]) <= TOL for i in range(3)))
        if n > seen:
            best, seen = c, n
    return best[:3]


def trim(im, bg):
    w, h = im.size
    px = im.load()

    def uniform(coords):
        for x, y in coords:
            p = px[x, y]
            if p[3] > 128 and any(abs(p[i] - bg[i]) > TOL for i in range(3)):
                return False
        return True

    top, bottom, left, right = 0, h - 1, 0, w - 1
    while top < bottom and uniform([(x, top) for x in range(w)]):
        top += 1
    while bottom > top and uniform([(x, bottom) for x in range(w)]):
        bottom -= 1
    while left < right and uniform([(left, y) for y in range(top, bottom + 1)]):
        left += 1
    while right > left and uniform([(right, y) for y in range(top, bottom + 1)]):
        right -= 1
    if right - left < 4 or bottom - top < 4:
        return im                      # nothing survived; keep the original
    return im.crop((left, top, right + 1, bottom + 1))


def main(src):
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.abspath(os.path.join(here, "..", "..", "public", "vendors"))
    if not os.path.isdir(out_dir):
        os.makedirs(out_dir)

    index = {}
    for fname, vendor in sorted(MAP.items(), key=lambda kv: kv[1]):
        path = os.path.join(src, fname)
        if not os.path.exists(path):
            print("MISSING", fname)
            continue

        im = Image.open(path).convert("RGBA")
        bg = background(im)
        flat = Image.new("RGBA", im.size, bg + (255,))
        flat.alpha_composite(im)
        mark = trim(flat, bg)

        box_w = int(CARD_W * (1 - MARGIN * 2))
        box_h = int(CARD_H * (1 - MARGIN * 2))
        mark.thumbnail((box_w, box_h), Image.LANCZOS)

        card = Image.new("RGB", (CARD_W, CARD_H), bg)
        card.paste(
            mark.convert("RGB"),
            ((CARD_W - mark.size[0]) // 2, (CARD_H - mark.size[1]) // 2),
        )

        name = slug(vendor) + ".webp"
        card.save(os.path.join(out_dir, name), "WEBP", quality=88, method=6)
        kb = os.path.getsize(os.path.join(out_dir, name)) / 1024
        index[vendor] = name
        print("%-16s %-22s bg=%-16s %5.1f KB" % (vendor, name, str(bg), kb))

    # Written rather than hand-maintained: the component reads this, so a logo
    # added here cannot go missing from the board or vice versa.
    ts = os.path.join(os.path.abspath(os.path.join(here, "..", "..")), "lib", "vendor-logos.ts")
    lines = [
        "/* Generated by scripts/vendor-logos/build.py — do not edit by hand.",
        " * Keys are exactly what vendorOf() returns, so the board can join on them.",
        " */",
        "export const VENDOR_LOGOS: Record<string, string> = {",
    ]
    for vendor in sorted(index):
        lines.append('  %s: "/vendors/%s",' % (repr(vendor).replace("'", '"'), index[vendor]))
    lines.append("};")
    io.open(ts, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
    print("\nwrote lib/vendor-logos.ts with %d entries" % len(index))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\neupa\Desktop\aisathi")
