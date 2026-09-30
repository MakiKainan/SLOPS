"""Run: python test_gradients.py"""
import base64
from io import BytesIO
from PIL import Image, ImageColor, ImageChops
import server

client = server.app.test_client()
family = next(f['family'] for f in client.get('/fonts').get_json() if 'Sans' in f['family'])
payload = dict(text='Ocean', family=family, style='bold-italic', underline=True,
               foreground='#171717', background='#FFFFFF', guide=False, size=512, shape='square')
presets = [p for p in client.get('/presets').get_json() if p.get('gradient')]
assert len(presets) == 8
for preset in presets:
    for shape in server.make_typography.SHAPES:
        response = client.post('/render', json={**payload, **preset, 'shape': shape})
        assert response.status_code == 200, response.get_json()
        assert response.get_json()['warning'] is None
        image = Image.open(BytesIO(base64.b64decode(response.get_json()['png_base64'])))
        assert image.mode == 'RGB' and image.size == (512, 512)
        if shape == 'square':
            assert image.getpixel((0, 0)) == ImageColor.getrgb(preset['gradient'][0])
            assert image.getpixel((0, 511)) == ImageColor.getrgb(preset['gradient'][-1])
        else:
            assert image.getpixel((0, 0)) == (255, 255, 255)
        # Text remains visible on every gradient and shape.
        canvas = server.make_typography._gradient_canvas(512, preset['gradient'], shape)
        assert ImageChops.difference(image, canvas).getbbox(), 'Missing text'
response = client.post('/render', json={**payload, **presets[0], 'size': 1024, 'guide': True})
assert response.status_code == 200
assert Image.open(BytesIO(base64.b64decode(response.get_json()['png_base64']))).size == (1024, 1024)
for invalid in ([], ['#FFFFFF'], 'red', ['#FFFFFF', 'oops'], ['#FFFFFF', 7], ['#FFFFFF'] * 9):
    response = client.post('/render', json={**payload, 'gradient': invalid})
    assert response.status_code == 422, response.get_json()
print('PASS: eight gradients, all shapes, export size, contrast, invalid gradient validation')
