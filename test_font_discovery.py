"""Run with python test_font_discovery.py; never changes the real font folder."""
import base64
from io import BytesIO
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
from unittest.mock import patch
import warnings

from PIL import Image
import server


def test_live_discovery():
    source = server.ENGINE_DIR / 'fonts'
    with TemporaryDirectory() as tmp, patch.object(server, 'ENGINE_DIR', Path(tmp)), patch.object(server, 'CATALOG', {}):
        folder = Path(tmp) / 'fonts'
        folder.mkdir()
        client = server.app.test_client()
        assert client.get('/fonts').get_json() == []
        for style in ('Regular', 'Bold'):
            shutil.copyfile(source / f'BDSans-{style}.ttf', folder / f"Cat's Font-{style}.ttf")
        assert client.get('/fonts').get_json() == [
            {'family': "Cat's Font", 'category': None, 'styles': ['regular', 'bold']}
        ]
        response = client.get('/font-file', query_string={'family': "Cat's Font", 'style': 'bold'})
        assert response.status_code == 200
        assert response.data == (folder / "Cat's Font-Bold.ttf").read_bytes()
        response.close()
        for size in (512, 1024):
            response = client.post('/render', json=dict(text='Sweet Cat', family="Cat's Font", style='regular',
                foreground='#173210', background='#FFFFFF', shape='square', guide=False, size=size))
            assert response.status_code == 200, response.get_json()
            image = Image.open(BytesIO(base64.b64decode(response.get_json()['png_base64'])))
            assert image.size == (size, size)
            assert len(image.getcolors(size * size)) > 1
        (folder / 'Broken.ttf').write_bytes(b'not a font')
        with warnings.catch_warnings(record=True) as caught:
            assert len(client.get('/fonts').get_json()) == 1
            assert caught
        (folder / 'Broken.ttf').unlink()
        (folder / "Cat's Font-Bold.ttf").unlink()
        assert client.get('/fonts').get_json()[0]['styles'] == ['regular']
        (folder / "Cat's Font-Regular.ttf").rename(folder / 'New Name.ttf')
        assert client.get('/fonts').get_json()[0]['family'] == 'New Name'
    print('PASS: live discovery, filename names, styles, serving, rendering, invalid files, removal and rename')


if __name__ == '__main__':
    test_live_discovery()
