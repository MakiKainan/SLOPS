"""Render text as a sticker-ready typography image with simple cut-out shapes."""
import argparse
from io import BytesIO
import json
import re
from math import cos, sin, pi
from pathlib import Path
import sys
import warnings

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageColor, ImageOps

from typography_core import contrast, layout, render
from font_catalog import STYLES

PAPER = '#FFFFFF'
CIRCLE_INSET = 0.65  # Square-inscribed-in-circle limit is ~0.707; this leaves margin.
SHAPES = ('square', 'circle', 'hexagon', 'star')
SUPERSAMPLE = 4


def font_coverage(font_path, text):
    """Return sorted non-whitespace characters in text missing from font_path's cmap."""
    with TTFont(Path(font_path)) as font:
        glyphs = font.getBestCmap()
    return sorted({c for c in text if not c.isspace() and ord(c) not in glyphs})


def _draw_shape(draw, size, shape, *, fill=None, outline=None, width=1):
    inset = width // 2 if outline is not None else 0
    left, top, right, bottom = inset, inset, size - 1 - inset, size - 1 - inset
    box = (left, top, right, bottom)
    if shape == 'circle':
        draw.ellipse(box, fill=fill, outline=outline, width=width)
    elif shape == 'star':
        center = (size - 1) / 2
        radius = (right - left) / 2
        points = [(center + radius * (1 if i % 2 == 0 else .5) * cos(-pi / 2 + i * pi / 5),
                   center + radius * (1 if i % 2 == 0 else .5) * sin(-pi / 2 + i * pi / 5))
                  for i in range(10)]
        draw.polygon(points, fill=fill, outline=outline, width=width)
    elif shape == 'hexagon':
        w, h = right - left, bottom - top
        points = [(left + w * .25, top + h * .067), (left + w * .75, top + h * .067),
                  (right, top + h * .5), (left + w * .75, top + h * .933),
                  (left + w * .25, top + h * .933), (left, top + h * .5)]
        draw.polygon(points, fill=fill, outline=outline, width=width)
    else:
        draw.rectangle(box, fill=fill, outline=outline, width=width)


def _shape_canvas(size, background, shape):
    canvas = Image.new('RGB', (size, size), PAPER)
    big = size * SUPERSAMPLE
    mask = Image.new('L', (big, big))
    _draw_shape(ImageDraw.Draw(mask), big, shape, fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    canvas.paste(background, (0, 0, size, size), mask)
    return canvas


def _draw_guide(image, size, shape, color):
    outline = max(2, size // 256)
    _draw_shape(ImageDraw.Draw(image), size, shape, outline=color, width=outline)


def generate(text, color, background, font, font2=None, size=1024,
             min_contrast=4.5, shape='square', guide=False, *, style='regular', underline=False, gradient=None, text2=None):
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
    if shape not in SHAPES:
        raise ValueError(f"shape must be one of {SHAPES}, got {shape!r}.")
    if style not in STYLES:
        raise ValueError(f'Unknown style: {style!r}')
    if not isinstance(underline, bool):
        raise ValueError('underline must be a boolean.')
    underline = underline or style == 'underline'
    font = Path(font)
    if not font.is_file():
        raise FileNotFoundError(font.resolve())
    if font2 is not None:
        font2 = Path(font2)
        if not font2.is_file():
            raise FileNotFoundError(font2.resolve())
    if gradient is not None and (not isinstance(gradient, list) or not 2 <= len(gradient) <= 8
            or any(not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in gradient)):
        raise ValueError('gradient must contain 2 to 8 six-digit hex colors.')
    try:
        ratio = contrast(color, background)
        if gradient:
            ratio = min(contrast(color, c) for c in gradient)
    except ValueError as exc:
        raise ValueError(f'Invalid color: {exc}') from exc
    if ratio < min_contrast:
        warnings.warn(f'contrast {ratio:.2f}:1 is below recommended {min_contrast}:1', UserWarning)
    if text2 is not None and (not isinstance(text2, str) or not text2.strip()):
        raise ValueError("text2 must be a nonblank string.")
    lines = [text.strip(), text2.strip()] if text2 is not None else layout(text)
    fonts = [font, font2] if len(lines) == 2 and font2 else [font] * len(lines)
    for f, line in zip(fonts, lines):
        missing = font_coverage(f, line)
        if missing:
            raise ValueError(f'{f} lacks these characters: {missing}')
    ink, paper = ('#FFFFFF', '#000000') if gradient else (color, background)
    if shape == 'square':
        image, _, _ = render(fonts, lines, ink, size, paper, style=style, underline=underline)
        if gradient:
            mask = image.convert('L')
            image = _gradient_canvas(size, gradient, shape)
            image.paste(color, (0, 0, size, size), mask)
        if guide:
            _draw_guide(image, size, shape, color)
        return image
    if shape == 'circle':
        inner_size = round(size * CIRCLE_INSET)
        inner, _, _ = render(fonts, lines, ink, inner_size, paper, style=style, underline=underline)
    else:
        inner, bounds, _ = render(fonts, lines, ink, size, paper, style=style, underline=underline)
        inner = inner.crop(bounds)
        # Safe centered rectangles leave breathing room inside each cut boundary.
        w, h = {'hexagon': (.60, .60), 'star': (.34, .34)}[shape]
        inner.thumbnail((round(size * w), round(size * h)), Image.Resampling.LANCZOS)
    canvas = _gradient_canvas(size, gradient, shape) if gradient else _shape_canvas(size, background, shape)
    x, y = (size - inner.width) // 2, (size - inner.height) // 2
    if gradient:
        canvas.paste(color, (x, y, x + inner.width, y + inner.height), inner.convert('L'))
    else:
        canvas.paste(inner, (x, y))
    if guide:
        _draw_guide(canvas, size, shape, color)
    return canvas


# Caption box per shape: (max width, max height, vertical center), as fractions of the canvas.
CAPTION_BOX = {'square': (.84, .30, .79), 'circle': (.66, .28, .73),
               'hexagon': (.66, .28, .74), 'star': (.38, .22, .57)}


def generate_photo(photo, color, background, size=1024, shape='square', guide=False, *,
                   text='', font=None, font2=None, text2=None, style='regular', underline=False,
                   min_contrast=4.5):
    """Die-cut a photo into shape, with an optional caption on a rounded panel in the preset colors.

    photo is a PIL image. The caption follows generate()'s rules for fonts,
    styles and glyph coverage; without text no font is needed.
    """
    if size < 64:
        raise ValueError('size must be at least 64.')
    if shape not in SHAPES:
        raise ValueError(f"shape must be one of {SHAPES}, got {shape!r}.")
    if style not in STYLES:
        raise ValueError(f'Unknown style: {style!r}')
    try:
        ratio = contrast(color, background)
    except ValueError as exc:
        raise ValueError(f'Invalid color: {exc}') from exc
    canvas = _shape_canvas(size, ImageOps.fit(photo.convert('RGB'), (size, size), Image.Resampling.LANCZOS), shape)
    if text.strip() or (text2 or '').strip():
        if ratio < min_contrast:
            warnings.warn(f'contrast {ratio:.2f}:1 is below recommended {min_contrast}:1', UserWarning)
        font = Path(font)
        if not font.is_file():
            raise FileNotFoundError(font.resolve())
        if font2 is not None:
            font2 = Path(font2)
            if not font2.is_file():
                raise FileNotFoundError(font2.resolve())
        if text2 is not None and text2.strip() and text.strip():
            lines = [text.strip(), text2.strip()]
        else:
            caption_text = text.strip() or text2.strip()
            lines = [caption_text] if len(caption_text) <= 24 else layout(caption_text)
        fonts = [font, font2] if len(lines) == 2 and font2 else [font] * len(lines)
        for f, line in zip(fonts, lines):
            missing = font_coverage(f, line)
            if missing:
                raise ValueError(f'{f} lacks these characters: {missing}')
        caption, bounds, _ = render(fonts, lines, color, size, background, style=style,
                                    underline=underline or style == 'underline')
        caption = caption.crop(bounds)
        bw, bh, cy = CAPTION_BOX[shape]
        px, py = max(2, round(size * .025)), max(2, round(size * .025))
        text_height = min(round(size * (.12 if len(lines) == 1 else .24)), round(size * bh) - 2 * py)
        caption.thumbnail((round(size * bw) - 2 * px, text_height), Image.Resampling.LANCZOS)
        w = max(caption.width + 2 * px, round(size * bw * .75))
        h = caption.height + 2 * py
        x, y = (size - w) // 2, round(size * cy - h / 2)
        ImageDraw.Draw(canvas).rounded_rectangle((x, y, x + w - 1, y + h - 1), radius=max(2, round(size * .018)), fill=background)
        canvas.paste(caption, (x + (w - caption.width) // 2, y + py))
    if guide:
        _draw_guide(canvas, size, shape, color)
    return canvas


def _gradient_canvas(size, colors, shape):
    stops = [ImageColor.getrgb(c) for c in colors]
    ramp = Image.new('RGB', (1, size))
    pixels = []
    for y in range(size):
        position = y / (size - 1) * (len(stops) - 1)
        index = min(int(position), len(stops) - 2)
        fraction = position - index
        pixels.append(tuple(round(a + (b - a) * fraction) for a, b in zip(stops[index], stops[index + 1])))
    ramp.putdata(pixels)
    return _shape_canvas(size, ramp.resize((size, size)), shape)


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
    parser.add_argument('--shape', choices=SHAPES, default='square')
    parser.add_argument('--guide', action='store_true')
    parser.add_argument('--style', choices=STYLES, default='regular')
    parser.add_argument('--underline', action='store_true')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        image = generate(args.text, args.color, args.background, args.font, args.font2,
                          args.size, args.min_contrast, args.shape, args.guide,
                          style=args.style, underline=args.underline)
    except (ValueError, FileNotFoundError) as exc:
        print(f'error: {exc}', file=sys.stderr)
        sys.exit(1)
    image.save(args.output)
    print(args.output.resolve())


if __name__ == '__main__':
    main()
