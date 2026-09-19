# Handoff: typography sticker generator (standalone scripts)

Self-contained bundle of the Python code that turns **text + font + color + shape** into a
sticker-ready image. No web server, no UI — just the engine, meant to be imported (or shelled out
to) from whatever frontend/glue code gets built next. This is a copy split out from a larger
dataset-tooling repo; it doesn't depend on anything outside this folder.

## Setup

```sh
python -m pip install -r requirements.txt
```

Python 3.10+. No network access, GPU, or API keys needed — everything renders locally.

## Files

| File | Role |
|---|---|
| `typography_core.py` | Shaping/compositing engine: HarfBuzz+FreeType text shaping, WCAG contrast math, line-splitting. Not usually called directly. |
| `font_catalog.py` | Scans `fonts/` into `family -> style -> file`, for building a font picker. |
| `make_typography.py` | The main entry point: `generate()` function + a CLI wrapper. |
| `fonts/` | Curated font files (2 families: a sans + a script/cursive one, plus Pacifico) and `categories.json` tagging which are cursive/script. Drop in more `.ttf`/`.otf` files to extend the catalog. |
| `color_presets.json` | Curated foreground/background color pairs, pre-checked for contrast ≥4.5:1. |

## The API you'll actually call

```python
from make_typography import generate, load_color_presets, to_png_bytes
from font_catalog import scan_fonts, resolve_font, available_styles

catalog = scan_fonts('fonts')          # do this once at startup, not per request
presets = load_color_presets('color_presets.json')

font_path = resolve_font(catalog, 'Beautifully Delicious Sans', 'bold')

image = generate(
    text='Cut Me',
    color='#171717',        # foreground (hex or a PIL-recognized name)
    background='#CBF3DC',
    font=font_path,          # Path or str to a .ttf/.otf
    font2=None,              # optional 2nd font, used for the bottom line on 2-word+ text
    size=1024,               # square canvas, pixels
    shape='circle',          # 'square' or 'circle'
    guide=True,              # thin cut-line outline along the shape edge
)
image.save('cut_me.png')                 # it's a plain PIL.Image
png_bytes = to_png_bytes(image)          # or get raw PNG bytes for an HTTP response, etc.
```

### `scan_fonts(folder) -> dict[family_name, FontFamily]`

`FontFamily` has `.name`, `.styles` (dict of `"regular"/"bold"/"italic"/"bold-italic"` -> file path —
only the styles that actually exist), and `.category` (from `categories.json`, e.g. `"script"` for
cursive fonts, `None` if untagged). Use `available_styles(family)` to know which style toggles to
show/enable for a given family. Variable fonts and unparseable files are skipped with a `warnings.warn`,
not an error.

### `resolve_font(catalog, family, style='regular') -> Path`

Raises `ValueError` naming the family and the styles it actually has if you ask for one it doesn't.
Only call this with a family/style combo you got from `scan_fonts`/`available_styles` — don't let a
user type a style name freely.

### `generate(...) -> PIL.Image.Image`

The one function that matters. Full behavior:

- **Layout**: 2+ word text auto-splits into two lines (top/bottom), balanced by length. `font2`, if
  given, renders the bottom line; otherwise both lines use `font`. Single-word text is one line.
- **Colors**: `color`/`background` are validated as real colors immediately (`ValueError` if not).
  If their contrast is below `min_contrast` (default 4.5), it **warns** (`UserWarning`) but still
  renders — it does not block. Wrap the call in `warnings.catch_warnings(record=True)` if you want to
  surface that to a user.
- **Fonts**: raises `FileNotFoundError` (with the resolved absolute path) if `font`/`font2` don't
  exist, and `ValueError` naming the exact missing characters if the font's glyph set doesn't cover
  the text — this is a hard failure, not a silently blank/garbled render.
- **Shape**: `'square'` is the plain canvas. `'circle'` insets the text and die-cuts it into a circle
  on a white canvas filled with `background` (the seam is invisible since the fill matches). `guide`
  draws a thin outline along whichever shape's edge — useful when `background` is close to white.
- **Validation**: raises `ValueError` for blank text, `size < 64`, or an unknown `shape`.

### CLI (for quick manual testing, not meant for the frontend to shell out to)

```sh
python make_typography.py --text "Hello World" --color "#171717" --background "#FFF0CF" \
  --font fonts/BDSans-Bold.ttf --font2 fonts/BDScript-Bold.ttf \
  --shape circle --guide --output out.png
```

## Verified working

- `python -m py_compile` on all three `.py` files.
- `scan_fonts('fonts')` finds all 3 families with correct styles/categories.
- CLI end-to-end render (two-font two-line, circle shape, guide outline) produces a valid PNG.
- `load_color_presets` returns all 6 curated pairs.

## Known limits (not bugs, just scope)

- Square canvases only (no arbitrary width/height).
- No transparency — output is always a solid, opaque image.
- No synthetic bold/italic or variable-font weight axes — styling comes only from picking a
  different font file.
- `layout()` treats a literal `\n` in the text as ordinary whitespace, not a forced line break.
- No minimum-legible-size guard for very long strings — cap input length in whatever UI sits on top.
