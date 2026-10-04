#!/usr/bin/env python3
"""Exact dominant colors of a design image (mockup, theme screenshot, exported frame).

Counts real pixel colors instead of averaging, so flat UI colors in a PNG come back as their exact hex values. JPEG
compression shifts colors by a step or two per channel, so confirm JPEG results against the design source.
Near-identical shades (anti-aliasing, JPEG noise) are grouped under the most frequent exact color of the group.
Transparent pixels are composited onto white first.

Usage: python3 palette.py <image> [--colors 12] [--merge 3] [--json]
Needs Pillow: pip install pillow
"""
import argparse
import json
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("palette.py needs Pillow: pip install pillow")


def luminance(rgb):
    def channel(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


MAX_EXACT_COLORS = 20000  # photos have hundreds of thousands; the rarest ones never make a palette


def load(path):
    try:
        im = Image.open(path)
        im.load()
    except (OSError, ValueError) as err:
        sys.exit(f"palette.py: can't read {path}: {err}")
    rgba = im.convert("RGBA")
    return Image.alpha_composite(Image.new("RGBA", rgba.size, (255, 255, 255, 255)), rgba).convert("RGB")


def palette(path, n, merge):
    img = load(path)
    total = img.width * img.height
    colors = sorted(img.getcolors(maxcolors=total) or [], reverse=True)[:MAX_EXACT_COLORS]
    clusters = []  # [representative rgb, count]
    for count, rgb in colors:
        for cluster in clusters:
            rep = cluster[0]
            if sum((x - y) ** 2 for x, y in zip(rgb, rep)) <= merge * merge:
                cluster[1] += count
                break
        else:
            if len(clusters) < 400:  # rare colors beyond this are noise for a palette
                clusters.append([rgb, count])
    clusters.sort(key=lambda c: c[1], reverse=True)
    rows = []
    for rgb, count in clusters[:n]:
        rows.append({
            "hex": "#{:02X}{:02X}{:02X}".format(*rgb),
            "share": round(100 * count / total, 2),
            "contrast_on_white": round(contrast(rgb, (255, 255, 255)), 2),
            "contrast_on_black": round(contrast(rgb, (0, 0, 0)), 2),
        })
    return {"image": path, "size": [img.width, img.height], "colors": rows}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("image")
    ap.add_argument("--colors", type=int, default=12, help="how many colors to report (default 12)")
    ap.add_argument("--merge", type=int, default=3, help="RGB distance under which shades are grouped (default 3; raise it for noisy JPEGs)")
    ap.add_argument("--json", action="store_true", help="print JSON instead of a table")
    a = ap.parse_args()
    result = palette(a.image, a.colors, a.merge)
    if a.json:
        print(json.dumps(result, indent=2))
        return
    w, h = result["size"]
    print(f"{a.image} ({w}x{h})")
    print(f"{'hex':<9} {'share%':>7} {'vs white':>9} {'vs black':>9}")
    for r in result["colors"]:
        print(f"{r['hex']:<9} {r['share']:>7} {r['contrast_on_white']:>9} {r['contrast_on_black']:>9}")
    print("Contrast targets: 4.5 for body text, 3.0 for large text and controls (WCAG 2.2 AA).")


if __name__ == "__main__":
    main()
