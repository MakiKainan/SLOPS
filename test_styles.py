"""Run with python test_styles.py; checks native/synthesized styles and underline."""
import base64
from io import BytesIO

from PIL import Image
import server
from typography_core import shape_line


def test_styles():
    client = server.app.test_client()
    fonts = client.get('/fonts').get_json()
    styles = list(server.font_catalog.STYLES)
    for family in fonts:
        assert family['styles'] == styles
        results = []
        for style in styles:
            payload = dict(text='Sweet Cat', family=family['family'], style=style,
                           foreground='#171717', background='#CBF3DC',
                           shape='star', guide=True, size=512)
            response = client.post('/render', json=payload)
            assert response.status_code == 200, (family, style, response.get_json())
            png = base64.b64decode(response.get_json()['png_base64'])
            assert Image.open(BytesIO(png)).size == (512, 512)
            results.append(png)
        assert len(set(results)) == 5, f"Styles did not change {family['family']}"
    # Prefer actual font files, and never embolden/slant native variants twice.
    for name, family in server.CATALOG.items():
        for style, path in family.styles.items():
            assert server.font_catalog.resolve_font(server.CATALOG, name, style) == path
            assert shape_line(path, 'Cat').tobytes() == shape_line(path, 'Cat', style=style).tobytes()
    for field, value, status in [('style', 'unknown', 422), ('underline', 'yes', 400)]:
        response = client.post('/render', json={**payload, field: value})
        assert response.status_code == status
    response = client.post('/render', json={**payload, 'size': 1024})
    assert response.status_code == 200
    assert Image.open(BytesIO(base64.b64decode(response.get_json()['png_base64']))).size == (1024, 1024)
    print(f'PASS: {len(fonts)} fonts × 5 standalone styles, native variants, export, validation')


if __name__ == '__main__':
    test_styles()
