"""Render text as a sticker-ready typography image: any font, any two colors, square or circle."""
import argparse
from io import BytesIO
import json
from pathlib import Path
import sys
import warnings

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw

from typography_core import contrast, layout, render

PAPER = '#FFFFFF'
CIRCLE_INSET = 0.65  # Square-inscribed-in-circle limit is ~0.707; this leaves margin.
SUPERSAMPLE = 4


def font_coverage(font_path, text):
    """Return sorted non-whitespace characters in text missing from font_path's cmap."""
    with TTFont(Path(font_path)) as font:
        glyphs = font.getBestCmap()
    return sorted({c for c in text if not c.isspace() and ord(c) not in glyphs})


def _circle_canvas(size, background):
    canvas = Image.new('RGB', (size, size), PAPER)
    big = size * SUPERSAMPLE
    mask = Image.new('L', (big, big))
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    canvas.paste(background, (0, 0, size, size), mask)
    return canvas


def _draw_guide(image, size, shape, color):
    outline = max(2, size // 256)
    draw = ImageDraw.Draw(image)
    box = (outline // 2, outline // 2, size - 1 - outline // 2, size - 1 - outline // 2)
    if shape == 'circle':
        draw.ellipse(box, outline=color, width=outline)
    else:
        draw.rectangle(box, outline=color, width=outline)


def generate(text, color, background, font, font2=None, size=1024,
             min_contrast=4.5, shape='square', guide=False):
    """Render text as a sticker image (RGB, always opaque).

    Raises FileNotFoundError for missing font paths, ValueError for invalid
    colors/size/shape/text or fonts missing required glyphs. Warns
    (UserWarning) rather than raising if contrast(color, background) is below
    min_contrast. font2 is ignored when the text lays out to a single line.
    """
    if not text.strip():
        raise ValueError('text must not be blank.')
    if size < 64:
        raise ValueError('size must be at least 64.')
    if shape not in ('square', 'circle'):
        raise ValueError(f"shape must be 'square' or 'circle', got {shape!r}.")
    font = Path(font)
    if not font.is_file():
        raise FileNotFoundError(font.resolve())
    if font2 is not None:
        font2 = Path(font2)
        if not font2.is_file():
            raise FileNotFoundError(font2.resolve())
    try:
        ratio = contrast(color, background)
    except ValueError as exc:
        raise ValueError(f'Invalid color: {exc}') from exc
    if ratio < min_contrast:
        warnings.warn(f'contrast {ratio:.2f}:1 is below recommended {min_contrast}:1', UserWarning)
    lines = layout(text)
    fonts = [font, font2] if len(lines) == 2 and font2 else [font] * len(lines)
    for f, line in zip(fonts, lines):
        missing = font_coverage(f, line)
        if missing:
            raise ValueError(f'{f} lacks these characters: {missing}')
    if shape == 'square':
        image, _, _ = render(fonts, lines, color, size, background)
        if guide:
            _draw_guide(image, size, shape, color)
        return image
    inner_size = round(size * CIRCLE_INSET)
    inner, _, _ = render(fonts, lines, color, inner_size, background)
    canvas = _circle_canvas(size, background)
    canvas.paste(inner, ((size - inner_size) // 2, (size - inner_size) // 2))
    if guide:
        _draw_guide(canvas, size, shape, color)
    return canvas


def load_color_presets(path='color_presets.json'):
    """Return [{"name", "foreground", "background"}, ...] from a curated JSON file."""
    return json.loads(Path(path).read_text(encoding='utf-8'))


def to_png_bytes(image):
    """PNG-encode an image for a frontend response or download."""
    buf = BytesIO()
    image.save(buf, format='PNG')
    return buf.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--text', required=True)
    parser.add_argument('--color', required=True)
    parser.add_argument('--background', required=True)
    parser.add_argument('--font', required=True, type=Path)
    parser.add_argument('--font2', type=Path, default=None)
    parser.add_argument('--size', type=int, default=1024)
    parser.add_argument('--min-contrast', type=float, default=4.5)
    parser.add_argument('--shape', choices=('square', 'circle'), default='square')
    parser.add_argument('--guide', action='store_true')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        image = generate(args.text, args.color, args.background, args.font, args.font2,
                          args.size, args.min_contrast, args.shape, args.guide)
    except (ValueError, FileNotFoundError) as exc:
        print(f'error: {exc}', file=sys.stderr)
        sys.exit(1)
    image.save(args.output)
    print(args.output.resolve())


if __name__ == '__main__':
    main()
