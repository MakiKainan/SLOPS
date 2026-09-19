"""Scan a folder of font files into family -> style -> path, for building font pickers."""
from dataclasses import dataclass
import json
import re
from pathlib import Path
import warnings

from fontTools.ttLib import TTFont

STYLES = ('regular', 'bold', 'italic', 'bold-italic')


@dataclass(frozen=True)
class FontFamily:
    name: str
    styles: dict
    category: str | None = None


def _style_name(font):
    mac_style = font['head'].macStyle
    bold, italic = bool(mac_style & 0b01), bool(mac_style & 0b10)
    if bold and italic:
        return 'bold-italic'
    if bold:
        return 'bold'
    if italic:
        return 'italic'
    return 'regular'


def _family_name(font):
    name_table = font['name']
    return (name_table.getDebugName(16) or name_table.getDebugName(1) or '').strip()


def _load_categories(folder):
    path = Path(folder) / 'categories.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def scan_fonts(folder):
    """Discover fonts by filename, grouping standard style suffixes together."""
    folder = Path(folder)
    categories = _load_categories(folder)
    families = {}
    for path in sorted(folder.rglob('*')):
        if path.suffix.lower() not in ('.ttf', '.otf'):
            continue
        try:
            with TTFont(path, lazy=True) as font:
                if 'fvar' in font:
                    warnings.warn(f'Skipping variable font {path}: axis selection is not supported.')
                    continue
                metadata_name = _family_name(font)
                name = re.sub(r'[-_ ](?:regular|bold[-_ ]?italic|bold|italic)$', '', path.stem, flags=re.I) or path.stem
                style = _style_name(font)
        except Exception as exc:
            warnings.warn(f'Skipping {path}: {exc}')
            continue
        family = families.setdefault(name, FontFamily(name, {}, categories.get(name, categories.get(metadata_name))))
        if style in family.styles:
            warnings.warn(f'Duplicate {name} {style} font; keeping {family.styles[style]}, ignoring {path}.')
            continue
        family.styles[style] = path
    return families


def available_styles(family):
    """Styles this family actually ships, in a stable UI order."""
    return [s for s in STYLES if s in family.styles]


def resolve_font(catalog, family, style='regular'):
    """Return the file for family+style; raises ValueError naming what's available."""
    if family not in catalog:
        raise ValueError(f'Unknown font family: {family!r}. Available: {sorted(catalog)}')
    fam = catalog[family]
    if style not in fam.styles:
        raise ValueError(f'{family} has no {style} style. Available styles: {available_styles(fam)}')
    return fam.styles[style]
