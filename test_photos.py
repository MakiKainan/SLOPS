"""Run: python test_photos.py"""
import base64
from io import BytesIO
from PIL import Image, ImageChops
import server

client = server.app.test_client()
family = next(f['family'] for f in client.get('/fonts').get_json() if 'Sans' in f['family'])


def png(color='#3366CC', size=(900, 600)):
    buf = BytesIO()
    Image.new('RGB', size, color).save(buf, format='PNG')
    return buf.getvalue()


def upload(token, data, name='photo.png'):
    return client.post(f'/upload/{token}', data={'photo': (BytesIO(data), name)}, content_type='multipart/form-data')


def new_session():
    r = client.post('/photo-session')
    assert r.status_code == 200 and r.get_json()['expires_in'] == 600
    return r.get_json()['token']


# Session lifecycle: waiting -> ready, single use.
token = new_session()
assert client.get(f'/photo-session/{token}').get_json()['status'] == 'waiting'
assert upload(token, png()).status_code == 200
status = client.get(f'/photo-session/{token}').get_json()
assert status['status'] == 'ready', status
photo = status['photo']
assert upload(token, png()).status_code == 410, 'token must be single use'
assert client.get('/photo-session/nope').get_json()['status'] == 'expired'
assert upload('nope', png()).status_code == 410

# Expired session.
token = new_session()
server.SESSIONS[token]['expires'] = 0
assert upload(token, png()).status_code == 410

# Bad uploads.
# Photos can exceed the normal JSON limit without relaxing it for /render.
buf = BytesIO()
Image.new('RGB', (150, 150), '#3366CC').save(buf, format='PNG', compress_level=0)
assert len(buf.getvalue()) > server.app.config['MAX_CONTENT_LENGTH']
assert upload(new_session(), buf.getvalue()).status_code == 200
assert client.post('/render', json={'text': 'x' * (17 * 1024)}).status_code == 413
assert upload(new_session(), b'not an image', 'x.jpg').status_code == 422
assert upload(new_session(), b'0' * (16 * 1024 * 1024)).status_code == 413
assert client.post(f'/upload/{new_session()}', data={}, content_type='multipart/form-data').status_code == 400

# Transparent PNG is flattened onto white; orientation and size are capped.
token = new_session()
buf = BytesIO()
Image.new('RGBA', (3000, 1000), (0, 0, 0, 0)).save(buf, format='PNG')
assert upload(token, buf.getvalue()).status_code == 200
big = server.PHOTOS[client.get(f'/photo-session/{token}').get_json()['photo']][1]
assert big.mode == 'RGB' and max(big.size) == 2048 and big.getpixel((0, 0)) == (255, 255, 255)

# Thumbnail.
r = client.get(f'/photo/{photo}?w=120')
assert r.status_code == 200 and max(Image.open(BytesIO(r.data)).size) == 120

# Render with the photo: every shape, with and without a caption.
base = dict(family=family, style='bold', foreground='#171717', background='#FFF0CF', guide=False, size=512, photo=photo)
for shape in server.make_typography.SHAPES:
    plain = client.post('/render', json={**base, 'text': '', 'shape': shape})
    assert plain.status_code == 200, plain.get_json()
    img = Image.open(BytesIO(base64.b64decode(plain.get_json()['png_base64'])))
    assert img.mode == 'RGB' and img.size == (512, 512)
    assert img.getpixel((256, 256)) == (0x33, 0x66, 0xCC)
    assert img.getpixel((0, 0)) == ((255, 255, 255) if shape != 'square' else (0x33, 0x66, 0xCC))
    captioned = client.post('/render', json={**base, 'text': 'Hi Mom', 'shape': shape})
    assert captioned.status_code == 200, captioned.get_json()
    cap = Image.open(BytesIO(base64.b64decode(captioned.get_json()['png_base64'])))
    assert ImageChops.difference(img, cap).getbbox(), f'caption missing on {shape}'
    # Captions must stay inside the cut shape, including the narrow star.
    for original, caption_pixel in zip(img.getdata(), cap.getdata()):
        if original == (255, 255, 255):
            assert caption_pixel == original, f'caption crosses {shape} cut edge'
r = client.post('/render', json={**base, 'text': 'Sweet', 'text2': 'Dreams', 'family2': family, 'shape': 'circle', 'guide': True, 'size': 1024})
assert r.status_code == 200, r.get_json()

# Short, two-line script captions must not collapse into a tiny label.
r = client.post('/render', json={**base, 'family': 'Autography', 'style': 'regular',
                                 'text': 'Goed', 'text2': 'Koop', 'family2': 'Autography', 'shape': 'square'})
assert r.status_code == 200, r.get_json()
cap = Image.open(BytesIO(base64.b64decode(r.get_json()['png_base64'])))
ink = Image.new('L', cap.size)
ink.putdata([255 if max(pixel) < 130 else 0 for pixel in cap.getdata()])
box = ink.getbbox()
assert box and box[3] - box[1] >= 512 * .20, 'script caption is too small'
panel = ImageChops.difference(Image.new('RGB', cap.size, '#3366CC'), cap).getbbox()
assert panel[2] - panel[0] >= 512 * .60, 'caption panel is too narrow'

# Unknown or deleted photo.
assert client.post('/render', json={**base, 'text': '', 'shape': 'square', 'photo': 'gone'}).get_json()['code'] == 'photo_not_found'
assert client.delete(f'/photo/{photo}').status_code == 204
assert client.get(f'/photo/{photo}').status_code == 404

# Text-only renders still reject blank text.
r = client.post('/render', json={**base, 'text': ' ', 'shape': 'square'} | {'photo': None})
assert r.status_code == 400
del base['photo']
assert client.post('/render', json={**base, 'text': ' ', 'shape': 'square'}).status_code == 422
print('PASS: photo sessions, upload validation, photo stickers in every shape, captions, cleanup')
