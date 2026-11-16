#!/usr/bin/env python3
"""Compare a built screen with its design reference.

Writes a sheet with the reference, the actual screenshot, and a difference heatmap side by side, and prints a
similarity score plus the vertical bands where most differences are, so a reviewer knows where to look.
The screenshot is scaled to the reference's width first (captures and references should share a CSS width).

Usage: python3 ui_compare.py <reference.png> <actual.png> <out.png> [--threshold 40] [--json]
Needs Pillow: pip install pillow
"""
import argparse
import json
import os
import sys

try:
    from PIL import Image, ImageChops, ImageDraw
except ImportError:  # pragma: no cover
    sys.exit("ui_compare.py needs Pillow: pip install pillow")

BAND = 40          # px height of the bands used to locate differences
MAX_SHEET_W = 2400  # keep the sheet readable and small


def load(path):
    """Opens an image, compositing transparency onto white, or exits with a readable message."""
    try:
        im = Image.open(path)
        im.load()
    except (OSError, ValueError) as err:
        sys.exit(f"ui_compare.py: can't read {path}: {err}")
    rgba = im.convert("RGBA")
    return Image.alpha_composite(Image.new("RGBA", rgba.size, (255, 255, 255, 255)), rgba).convert("RGB")


def compare(ref_path, act_path, out_path, threshold):
    ref, act = load(ref_path), load(act_path)
    if act.width != ref.width:
        act = act.resize((ref.width, max(1, round(act.height * ref.width / act.width))), Image.LANCZOS)
    height = max(ref.height, act.height)
    canvas_ref = Image.new("RGB", (ref.width, height), "white")
    canvas_ref.paste(ref, (0, 0))
    canvas_act = Image.new("RGB", (ref.width, height), "white")
    canvas_act.paste(act, (0, 0))

    diff = ImageChops.difference(canvas_ref, canvas_act)
    r, g, b = diff.split()
    strongest = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mask = strongest.point(lambda v: 255 if v > threshold else 0)
    hist = mask.histogram()
    mismatched = hist[255]
    total = ref.width * height
    similarity = round(100 * (1 - mismatched / total), 2)

    bands = []
    for top in range(0, height, BAND):
        box = mask.crop((0, top, ref.width, min(top + BAND, height)))
        h = box.histogram()
        ratio = h[255] / max(1, box.width * box.height)
        if ratio > 0.05:
            bands.append({"y": top, "height": box.height, "mismatch": round(100 * ratio, 1)})
    merged = []
    for band in bands:
        if merged and merged[-1]["y"] + merged[-1]["height"] == band["y"]:
            last = merged[-1]
            last["mismatch"] = round(max(last["mismatch"], band["mismatch"]), 1)
            last["height"] += band["height"]
        else:
            merged.append(dict(band))

    heat = Image.blend(canvas_act, Image.new("RGB", canvas_act.size, "white"), 0.6)
    heat.paste(Image.new("RGB", canvas_act.size, (220, 0, 0)), (0, 0), mask)

    gap, label_h = 16, 28
    sheet = Image.new("RGB", (ref.width * 3 + gap * 2, height + label_h), (245, 245, 245))
    draw = ImageDraw.Draw(sheet)
    for i, (img, label) in enumerate(((canvas_ref, "reference"), (canvas_act, "actual"), (heat, "differences"))):
        x = i * (ref.width + gap)
        sheet.paste(img, (x, label_h))
        draw.text((x + 8, 8), label, fill=(30, 30, 30))
    if sheet.width > MAX_SHEET_W:
        sheet = sheet.resize((MAX_SHEET_W, round(sheet.height * MAX_SHEET_W / sheet.width)), Image.LANCZOS)
    sheet.save(out_path)

    return {
        "reference": ref_path, "actual": act_path, "sheet": out_path,
        "reference_size": [ref.width, ref.height], "actual_size_scaled": [act.width, act.height],
        "similarity_percent": similarity, "threshold": threshold, "difference_bands": merged[:15],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("reference")
    ap.add_argument("actual")
    ap.add_argument("out")
    ap.add_argument("--threshold", type=int, default=40, help="per-channel difference treated as a mismatch (default 40)")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if os.path.splitext(a.out)[1].lower() not in (".png", ".jpg", ".jpeg", ".webp"):
        sys.exit(f"ui_compare.py: the output must end in .png, .jpg, or .webp: {a.out}")
    if os.path.dirname(a.out):
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
    res = compare(a.reference, a.actual, a.out, a.threshold)
    if a.json:
        print(json.dumps(res, indent=2))
        return
    print(f"similarity {res['similarity_percent']}%  (reference {res['reference_size'][0]}x{res['reference_size'][1]},"
          f" actual scaled to {res['actual_size_scaled'][0]}x{res['actual_size_scaled'][1]})")
    if res["actual_size_scaled"][1] != res["reference_size"][1]:
        print("heights differ: content is missing, extra, or spaced differently")
    for band in res["difference_bands"]:
        print(f"  differences at y={band['y']}..{band['y'] + band['height']}px (up to {band['mismatch']}% of the band)")
    print(f"sheet: {res['sheet']}")


if __name__ == "__main__":
    main()
