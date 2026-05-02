"""
Batch vectorize Docket icon PNGs from ChatGPT image gen → clean SVG.

Pipeline (v2 — smooth):
  1. Composite alpha onto white at full PNG resolution
  2. Lanczos-resize to 512 (preserves antialiased smoothness — KEY for vtracer)
  3. vtracer at color_precision=6 — captures antialiased edge gradients as
     intermediate color buckets, which become smooth Bezier curves
  4. Post-process: snap each detected fill color to nearest of
       {forestDark #0F3E17, mintKiss #CFE7D3, white (strip)}
     This reduces vtracer's ~20 detected colors to our 2 design tokens
     while keeping the smooth path geometry.

Result: white interiors preserved, mint accents only where source has them,
forestDark stroke, no jagged edges.
"""

import vtracer
from PIL import Image
import os
import re

SRC_DIR = r"C:\Users\minse\OneDrive\Desktop\docket icon assets"
OUT_DIR = "tmp/icons-svg"
TMP_DIR = "tmp/icons-flat"

# Target palette for post-trace snapping. Anything closer to white than to
# the other two gets stripped — that's how white interiors stay white.
TARGETS = {
    'fd': (0x0F, 0x3E, 0x17),   # forestDark — primary stroke
    'mk': (0xCF, 0xE7, 0xD3),   # mintKiss — accent fill
    'wh': (0xFF, 0xFF, 0xFF),   # white — STRIP (no path emitted)
}
TOK = {'fd': '#0F3E17', 'mk': '#CFE7D3'}


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def nearest(rgb: tuple[int, int, int]) -> str:
    return min(
        TARGETS,
        key=lambda k: sum((rgb[i] - TARGETS[k][i]) ** 2 for i in range(3)),
    )


def preprocess(src_path: str, dst_path: str) -> None:
    """Alpha-composite to white, Lanczos-resize to 512. NO color snapping
    — vtracer needs the antialiased edges to produce smooth Beziers."""
    img = Image.open(src_path).convert('RGBA')
    bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
    flat = Image.alpha_composite(bg, img).convert('RGB')
    flat.thumbnail((512, 512), Image.Resampling.LANCZOS)
    flat.save(dst_path)


def trace(flat_png: str, svg_out: str) -> None:
    vtracer.convert_image_to_svg_py(
        flat_png,
        svg_out,
        colormode='color',
        hierarchical='stacked',
        mode='spline',
        filter_speckle=4,
        color_precision=6,
        layer_difference=16,
        corner_threshold=60,
        length_threshold=4.0,
        splice_threshold=45,
        path_precision=3,
    )


def cleanup_svg(svg_path: str) -> None:
    """Snap each path's fill to one of {forestDark, mintKiss, strip}.
    Normalize svg tag to viewBox 0 0 512 512."""
    with open(svg_path, 'r', encoding='utf-8') as f:
        content = f.read()

    def remap(m: 're.Match[str]') -> str:
        full = m.group(0)
        color = m.group(1)
        target = nearest(hex_to_rgb(color))
        if target == 'wh':
            return ''
        return full.replace(f'fill="{color}"', f'fill="{TOK[target]}"')

    content = re.sub(
        r'<path\s+[^/]*fill="(#[A-Fa-f0-9]{6})"[^/]*/>',
        remap,
        content,
    )

    def fix_svg_tag(m: 're.Match[str]') -> str:
        attrs = m.group(1)
        attrs = re.sub(r'\s*(width|height)="[^"]*"', '', attrs).strip()
        if 'viewBox' not in attrs:
            attrs = f'viewBox="0 0 512 512" {attrs}'
        return f'<svg {attrs}>'

    content = re.sub(r'<svg\s+([^>]*)>', fix_svg_tag, content, count=1)
    content = re.sub(r'<!--.*?-->', '', content)
    content = re.sub(r'\n\s*\n', '\n', content).strip() + '\n'

    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(content)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(TMP_DIR, exist_ok=True)

    pngs = sorted(
        f for f in os.listdir(SRC_DIR)
        if f.lower().endswith('.png') and not any(
            brand in f.lower() for brand in ('irs', 'meet', 'square')
        )
    )
    print(f"Found {len(pngs)} PNG icons (excluding brand logos)")

    for i, fn in enumerate(pngs, 1):
        src = os.path.join(SRC_DIR, fn)
        out_name = f"icon-{i:02d}.svg"
        flat_name = f"icon-{i:02d}.png"
        flat_path = os.path.join(TMP_DIR, flat_name)
        svg_path = os.path.join(OUT_DIR, out_name)

        try:
            preprocess(src, flat_path)
            trace(flat_path, svg_path)
            cleanup_svg(svg_path)
            size = os.path.getsize(svg_path)
            print(f"  [{i:02d}] {fn} -> {out_name} ({size} bytes)")
        except Exception as e:
            print(f"  [{i:02d}] {fn} FAILED: {e}")

    print(f"\nDone. SVGs in {OUT_DIR}/")


if __name__ == "__main__":
    main()
