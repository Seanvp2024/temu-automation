from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "build"
ICON_PNG = BUILD_DIR / "icon.png"
ICON_ICO = BUILD_DIR / "icon.ico"


def ensure_build_dir() -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)


def draw_background(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    margin = int(size * 0.08)
    radius = int(size * 0.22)
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=radius,
        fill="#FF6A00",
    )
    return image


def draw_mark(size: int) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    body = (
        int(size * 0.23),
        int(size * 0.41),
        int(size * 0.61),
        int(size * 0.57),
    )
    body_radius = int(size * 0.09)
    draw.rounded_rectangle(body, radius=body_radius, fill="white")

    nose = [
        (int(size * 0.61), int(size * 0.39)),
        (int(size * 0.78), int(size * 0.49)),
        (int(size * 0.61), int(size * 0.59)),
    ]
    draw.polygon(nose, fill="white")

    tail_top = [
        (int(size * 0.24), int(size * 0.41)),
        (int(size * 0.12), int(size * 0.31)),
        (int(size * 0.28), int(size * 0.47)),
    ]
    tail_bottom = [
        (int(size * 0.24), int(size * 0.57)),
        (int(size * 0.12), int(size * 0.67)),
        (int(size * 0.28), int(size * 0.51)),
    ]
    draw.polygon(tail_top, fill="white")
    draw.polygon(tail_bottom, fill="white")

    flame = [
        (int(size * 0.09), int(size * 0.49)),
        (int(size * 0.18), int(size * 0.41)),
        (int(size * 0.18), int(size * 0.57)),
    ]
    draw.polygon(flame, fill="#FFD166")

    window_outer = (
        int(size * 0.44),
        int(size * 0.43),
        int(size * 0.55),
        int(size * 0.54),
    )
    window_inner = (
        int(size * 0.47),
        int(size * 0.46),
        int(size * 0.52),
        int(size * 0.51),
    )
    draw.ellipse(window_outer, fill="#FF6A00")
    draw.ellipse(window_inner, fill="#FFD9BF")

    return layer.rotate(-28, resample=Image.Resampling.BICUBIC, center=(size // 2, size // 2))


def create_icon(size: int = 512) -> Image.Image:
    base = draw_background(size)
    mark = draw_mark(size)
    return Image.alpha_composite(base, mark)


def main() -> None:
    ensure_build_dir()
    icon = create_icon()
    icon.save(ICON_PNG, format="PNG")
    icon.save(ICON_ICO, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"Generated {ICON_PNG}")
    print(f"Generated {ICON_ICO}")


if __name__ == "__main__":
    main()
