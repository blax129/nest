#!/usr/bin/env python3
"""Export SVG brand assets to PNG for favicon and social sharing.

Requires: npx @resvg/resvg-js-cli
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "images"
RESVG = ["npx", "--yes", "@resvg/resvg-js-cli"]

EXPORTS = [
    ("private-property-logo.svg", "private-property-logo.png", ["--fit-width", "1280", "--background", "transparent"]),
    ("private-property-logo.svg", "private-property-logo-new.png", ["--fit-width", "1280", "--background", "transparent"]),
    ("logo-icon.svg", "favicon-512.png", ["--fit-width", "512", "--fit-height", "512"]),
    ("logo-icon.svg", "apple-touch-icon.png", ["--fit-width", "180", "--fit-height", "180"]),
    ("logo-icon.svg", "favicon-32.png", ["--fit-width", "32", "--fit-height", "32"]),
    ("og-image.svg", "og-image.png", ["--fit-width", "1200", "--fit-height", "630"]),
]


def export_svg(svg_name: str, png_name: str, options: list[str]) -> None:
    svg_path = IMAGES / svg_name
    png_path = IMAGES / png_name
    command = [*RESVG, *options, str(svg_path), str(png_path)]
    subprocess.run(command, check=True, cwd=ROOT)
    print(f"Wrote {png_path.relative_to(ROOT)}")


def main() -> None:
    for svg_name, png_name, options in EXPORTS:
        export_svg(svg_name, png_name, options)

    favicon_32 = IMAGES / "favicon-32.png"
    if favicon_32.exists():
        try:
            from PIL import Image

            Image.open(favicon_32).save(ROOT / "favicon.ico", format="ICO", sizes=[(32, 32)])
            print("Wrote favicon.ico")
        except Exception as error:
            shutil.copy2(favicon_32, ROOT / "favicon.ico")
            print(f"Wrote favicon.ico via copy fallback ({error})")


if __name__ == "__main__":
    main()
