"""Run with python test_shapes.py: exercise preview/export shapes through the API."""
import base64
from io import BytesIO

from PIL import Image, ImageChops
import server


def test_shapes():
    client = server.app.test_client()
    family = next(f for f in client.get('/fonts').get_json() if 'Sans' in f['family'])
    payload = dict(text='Sweet Cat', family=family['family'], style=family['styles'][0],
                   foreground='#000000', background='#80C080', guide=False, size=512)
    for size in (512, 1024):
        for shape in server.make_typography.SHAPES:
            images = []
            for guide in (False, True):
                response = client.post('/render', json={**payload, 'shape': shape, 'size': size, 'guide': guide})
                assert response.status_code == 200, response.get_json()
                image = Image.open(BytesIO(base64.b64decode(response.get_json()['png_base64'])))
                assert image.size == (size, size) and image.mode == 'RGB'
                images.append(image)
            assert ImageChops.difference(*images).getbbox(), f'{shape}: missing cut line'
            plain = images[0]
            assert plain.getpixel((0, 0)) == ((128, 192, 128) if shape == 'square' else (255, 255, 255))
            if shape == 'star':
                assert plain.getpixel((size // 2, size // 10)) == (128, 192, 128)
                assert plain.getpixel((size // 10, size // 10)) == (255, 255, 255)
                assert plain.getpixel((size // 2, size * 9 // 10)) == (255, 255, 255)
            # The unprinted canvas must contain every text pixel, including antialiasing.
            canvas = server.make_typography._shape_canvas(size, payload['background'], shape)
            outside = canvas.convert('L').point(lambda p: 255 if p > 200 else 0)
            text = ImageChops.difference(plain, canvas).convert('L')
            assert text.getbbox(), f'{shape}: missing text'
            assert not ImageChops.multiply(text, outside).getbbox(), f'{shape}: text outside shape'
    for removed in ('unknown', 'oval', 'capsule'):
        response = client.post('/render', json={**payload, 'shape': removed})
        assert response.status_code == 422
    print('PASS: all four shapes, preview/export sizes, cut lines, text containment, removed shapes')


if __name__ == '__main__':
    test_shapes()
