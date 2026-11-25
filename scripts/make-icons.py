"""Draw the Letterbench icon set from the favicon mark."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"
PAPER = (243, 240, 232, 255)
TEAL = (30, 77, 92, 255)
L_PATH = [
    (10.2, 8.2),
    (13.8, 8.2),
    (13.8, 19.4),
    (21.2, 19.4),
    (21.2, 22.9),
    (10.2, 22.9),
]


def letter(draw: ImageDraw.ImageDraw, origin: float, scale: float, fill: tuple[int, int, int, int]) -> None:
    draw.polygon([(origin + x * scale, origin + y * scale) for x, y in L_PATH], fill=fill)


def regular(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), PAPER)
    draw = ImageDraw.Draw(image)
    scale = size / 32
    center = size / 2
    radius = 13 * scale
    draw.ellipse(
        [center - radius, center - radius, center + radius, center + radius],
        fill=TEAL,
    )
    letter(draw, 0, scale, PAPER)
    return image


def maskable(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), TEAL)
    draw = ImageDraw.Draw(image)
    # Keep the mark inside the center 80% so a circular mask does not clip it.
    scale = size / 32 * 0.72
    origin = (size - 32 * scale) / 2
    letter(draw, origin, scale, PAPER)
    return image


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    regular(192).save(ROOT / "icon-192.png")
    regular(512).save(ROOT / "icon-512.png")
    regular(180).save(ROOT / "apple-touch-icon.png")
    maskable(512).save(ROOT / "icon-512-maskable.png")


if __name__ == "__main__":
    main()
