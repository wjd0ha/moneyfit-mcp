from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"

NAVY = "#0B1D3A"
GREEN = "#11865B"
GOLD = "#D4AF37"
TEXT_GRAY = "#5F6670"
BG = "#F8F9F7"
WHITE = "#FFFFFF"

FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"
FONT_REGULAR = "C:/Windows/Fonts/malgun.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def rounded_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    radius: int,
    fill: str,
) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_symbol(
    image: Image.Image,
    center_x: int,
    top_y: int,
    scale: float,
    *,
    white_variant: bool = False,
) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    navy = WHITE if white_variant else NAVY
    green = WHITE if white_variant else GREEN
    gold = WHITE if white_variant else GOLD

    w = int(94 * scale)
    h = int(164 * scale)
    r = int(24 * scale)
    gap = int(82 * scale)
    left_x = center_x - gap - w
    right_x = center_x + gap
    y = top_y + int(50 * scale)

    # Side pillars: the two business/support figures.
    rounded_rect(draw, (left_x, y, left_x + w, y + h), r, navy)
    rounded_rect(draw, (right_x, y, right_x + w, y + h), r, green)

    # Inner white arch creates the "fit" bridge.
    arch_box = (
        center_x - int(116 * scale),
        y + int(46 * scale),
        center_x + int(116 * scale),
        y + int(252 * scale),
    )
    draw.ellipse(arch_box, fill=BG if not white_variant else NAVY)

    # Overlay bridge arms.
    draw.polygon(
        [
            (left_x + int(44 * scale), y + int(18 * scale)),
            (center_x - int(22 * scale), y + int(72 * scale)),
            (center_x - int(8 * scale), y + int(102 * scale)),
            (left_x + int(6 * scale), y + int(64 * scale)),
        ],
        fill=navy,
    )
    draw.polygon(
        [
            (right_x + w - int(44 * scale), y + int(18 * scale)),
            (center_x + int(22 * scale), y + int(72 * scale)),
            (center_x + int(8 * scale), y + int(102 * scale)),
            (right_x + w - int(6 * scale), y + int(64 * scale)),
        ],
        fill=green,
    )

    # Heads.
    head_r = int(27 * scale)
    head_y = top_y
    draw.ellipse((left_x + int(12 * scale), head_y, left_x + int(12 * scale) + 2 * head_r, head_y + 2 * head_r), fill=navy)
    draw.ellipse((right_x + w - int(12 * scale) - 2 * head_r, head_y, right_x + w - int(12 * scale), head_y + 2 * head_r), fill=green)

    # Connection point.
    dot_r = int(24 * scale)
    draw.ellipse(
        (center_x - dot_r, y + int(55 * scale), center_x + dot_r, y + int(55 * scale) + 2 * dot_r),
        fill=WHITE if not white_variant else NAVY,
    )
    inner_r = int(18 * scale)
    draw.ellipse(
        (
            center_x - inner_r,
            y + int(55 * scale) + dot_r - inner_r,
            center_x + inner_r,
            y + int(55 * scale) + dot_r + inner_r,
        ),
        fill=gold,
    )


def center_text(draw: ImageDraw.ImageDraw, y: int, text: str, fnt: ImageFont.FreeTypeFont, fill: str) -> None:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    x = (600 - (bbox[2] - bbox[0])) // 2
    draw.text((x, y), text, font=fnt, fill=fill)


def create_icon() -> Image.Image:
    canvas = Image.new("RGB", (600, 600), BG)
    shadow = Image.new("RGBA", (600, 600), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((88, 78, 512, 502), radius=92, fill=(11, 29, 58, 34))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow)

    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rounded_rectangle((82, 70, 518, 506), radius=96, fill=WHITE)
    draw_symbol(canvas, 300, 153, 1.08)

    return canvas.convert("RGB")


def create_logo() -> Image.Image:
    canvas = Image.new("RGB", (600, 600), BG).convert("RGBA")
    draw = ImageDraw.Draw(canvas, "RGBA")

    draw_symbol(canvas, 300, 86, 0.98)

    kr_font = font(FONT_BOLD, 55)
    en_font = font(FONT_REGULAR, 18)
    slogan_font = font(FONT_REGULAR, 22)

    y = 348
    first = "사장님"
    second = " 머니핏"
    first_bbox = draw.textbbox((0, 0), first, font=kr_font)
    second_bbox = draw.textbbox((0, 0), second, font=kr_font)
    total_w = (first_bbox[2] - first_bbox[0]) + (second_bbox[2] - second_bbox[0])
    x = (600 - total_w) // 2
    draw.text((x, y), first, font=kr_font, fill=NAVY)
    draw.text((x + first_bbox[2] - first_bbox[0], y), second, font=kr_font, fill=GREEN)

    center_text(draw, 424, "MONEY FIT FOR OWNERS", en_font, TEXT_GRAY)
    draw.rounded_rectangle((280, 468, 320, 472), radius=2, fill=GREEN)
    center_text(draw, 500, "사업에 맞는 지원금, 찾기부터 신청까지", slogan_font, NAVY)

    return canvas.convert("RGB")


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    create_icon().save(ASSETS / "moneyfit-icon-600.png", "PNG")
    create_logo().save(ASSETS / "moneyfit-logo-600.png", "PNG")


if __name__ == "__main__":
    main()
