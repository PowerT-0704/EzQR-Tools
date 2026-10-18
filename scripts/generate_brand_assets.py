"""Generate outlined EzQR-Tools brand PNG and Windows ICO assets.

The checked-in source mark has no outer padding and a very thin dark hairline.
This script preserves that artwork, adds a light-background-safe outer stroke,
and emits the runtime/icon assets used by Electron.

Requires Pillow:
    python -m pip install pillow
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "resources" / "logo-source.png"
PNG_OUTPUT = ROOT / "resources" / "logo.png"
RENDERER_LOGO = ROOT / "src" / "renderer" / "public" / "logo.png"
DOCS_LOGO = ROOT / "docs" / "images" / "ezqr-brand.png"
ICO_OUTPUT = ROOT / "resources" / "EzQR-Tools.ico"

CANVAS_SIZE = 1024
MARK_SIZE = 928
STROKE_RADIUS = 36
STROKE_COLOR = (53, 81, 111, 255)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing source logo: {SOURCE}")

    source = Image.open(SOURCE).convert("RGBA")
    mark = source.resize((MARK_SIZE, MARK_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    inset = (CANVAS_SIZE - MARK_SIZE) // 2
    canvas.alpha_composite(mark, (inset, inset))

    alpha = canvas.getchannel("A")
    dilated = alpha.filter(ImageFilter.MaxFilter(STROKE_RADIUS * 2 + 1))
    outline = Image.new("RGBA", canvas.size, STROKE_COLOR)
    outline.putalpha(dilated)
    outline.alpha_composite(canvas)

    PNG_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    RENDERER_LOGO.parent.mkdir(parents=True, exist_ok=True)
    DOCS_LOGO.parent.mkdir(parents=True, exist_ok=True)
    outline.save(PNG_OUTPUT, optimize=True)
    outline.save(RENDERER_LOGO, optimize=True)
    outline.resize((512, 512), Image.Resampling.LANCZOS).save(DOCS_LOGO, optimize=True)

    ico_base = outline.resize((256, 256), Image.Resampling.LANCZOS)
    ico_base.save(
        ICO_OUTPUT,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print(f"PNG: {PNG_OUTPUT}")
    print(f"ICO: {ICO_OUTPUT}")
    print(f"Renderer logo: {RENDERER_LOGO}")
    print(f"Docs logo: {DOCS_LOGO}")


if __name__ == "__main__":
    main()

