"""Shared HarfBuzz/FreeType shaping, compositing and WCAG contrast helpers.

Used by both generate_dataset.py (the fixed LoRA-dataset builder) and
make_typography.py (the general-purpose, any-font typography renderer).
"""
from PIL import Image, ImageChops, ImageColor
import freetype
import uharfbuzz as hb


def luminance(hex_color):
    rgb = [v / 255 for v in ImageColor.getrgb(hex_color)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(v * w for v, w in zip(linear, (.2126, .7152, .0722)))


def contrast(a, b):
    light, dark = sorted((luminance(a), luminance(b)), reverse=True)
    return (light + .05) / (dark + .05)


def layout(text):
    # Every multi-word phrase becomes a top line over a bottom line, balanced by length.
    words = text.split()
    if len(words) < 2:
        return [text]
    split = min(range(1, len(words)),
                key=lambda i: abs(len(' '.join(words[:i])) - len(' '.join(words[i:]))))
    return [' '.join(words[:split]), ' '.join(words[split:])]


def shape_line(font_path, text, pixels=600):
    # HarfBuzz preserves OpenType joins, kerning and ligatures on Windows and Linux.
    face = freetype.Face(str(font_path))
    face.set_pixel_sizes(0, pixels)
    font = hb.Font(hb.Face(font_path.read_bytes()))
    font.scale = (pixels * 64, pixels * 64)
    hb.ot_font_set_funcs(font)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf)
    glyphs = []
    pen_x = pen_y = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        face.load_glyph(info.codepoint, freetype.FT_LOAD_RENDER)
        slot = face.glyph
        bitmap = slot.bitmap
        x = round((pen_x + pos.x_offset) / 64) + slot.bitmap_left
        y = -round((pen_y + pos.y_offset) / 64) - slot.bitmap_top
        if bitmap.width and bitmap.rows:
            data = bytes(bitmap.buffer)
            glyph = Image.frombytes('L', (bitmap.width, bitmap.rows), data,
                                    'raw', 'L', bitmap.pitch)
            glyphs.append((x, y, glyph))
        pen_x += pos.x_advance
        pen_y += pos.y_advance
    if not glyphs:
        raise ValueError('Phrase produced no visible glyphs.')
    left = min(x for x, y, g in glyphs)
    top = min(y for x, y, g in glyphs)
    right = max(x + g.width for x, y, g in glyphs)
    bottom = max(y + g.height for x, y, g in glyphs)
    result = Image.new('L', (right-left, bottom-top))
    for x, y, glyph in glyphs:
        region = (x-left, y-top, x-left+glyph.width, y-top+glyph.height)
        result.paste(ImageChops.lighter(result.crop(region), glyph), region)
    return result


def render(fonts, lines, color, size, background='#FFFFFF', *, shape_pixels=600):
    """Composite lines of shaped text into a size x size RGB image.

    shape_pixels sets the FreeType/HarfBuzz shaping resolution per line before
    downscaling to fit; pass an int to use it for every line, or a sequence
    with one entry per line (a thin cursive font needs a higher value than a
    bold sans one to shape cleanly).
    """
    pixels_list = [shape_pixels] * len(lines) if isinstance(shape_pixels, int) else list(shape_pixels)
    if len(pixels_list) != len(lines):
        raise ValueError('shape_pixels must have one entry per line')
    masks = [shape_line(font, line, px) for font, line, px in zip(fonts, lines, pixels_list)]
    if len(masks) == 2:
        top, bottom = masks
        scale = min(top.width / bottom.width, 2 * top.height / bottom.height)
        masks[1] = bottom.resize((max(1, round(bottom.width*scale)), max(1, round(bottom.height*scale))),
                                 Image.Resampling.LANCZOS)
    gap = 90  # Script swashes already add air between the lines.
    width = max(m.width for m in masks)
    height = sum(m.height for m in masks) + gap * (len(masks)-1)
    combined = Image.new('L', (width, height))
    y = 0
    for mask in masks:
        combined.paste(mask, ((width-mask.width)//2, y))
        y += mask.height + gap
    ratio = min(size * .80 / width, size * .80 / height, 1)
    combined = combined.resize((max(1, round(width*ratio)), max(1, round(height*ratio))),
                               Image.Resampling.LANCZOS)
    mask = Image.new('L', (size, size))
    mask.paste(combined, ((size-combined.width)//2, (size-combined.height)//2))
    bounds = mask.getbbox()
    if not bounds or min(bounds[0], bounds[1], size-bounds[2], size-bounds[3]) < size * .08:
        raise ValueError(f'Artwork is blank or too close to the edge: {lines}')
    image = Image.new('RGB', (size, size), background)
    image.paste(color, (0, 0, size, size), mask)
    return image, bounds, pixels_list[0] * ratio  # First line's pixel size after downscale.
