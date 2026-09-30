"""Run: python test_mixed_fonts.py"""
import server

client = server.app.test_client()
fonts = client.get('/fonts').get_json()
first = next(f['family'] for f in fonts if 'Sans' in f['family'])
second = next(f['family'] for f in fonts if 'Script' in f['family'])
payload = dict(text='Sweet little', text2='Dreams', family=first, family2=second,
               style='bold-italic', underline=True, foreground='#171717', background='#A8EDEA',
               gradient=['#A8EDEA', '#8FA9F4'], size=512, guide=False)
for shape in server.make_typography.SHAPES:
    mixed = client.post('/render', json={**payload, 'shape': shape})
    same = client.post('/render', json={**payload, 'shape': shape, 'family2': first})
    assert mixed.status_code == same.status_code == 200, mixed.get_json()
    assert mixed.get_json()['png_base64'] != same.get_json()['png_base64']
assert client.post('/render', json={**payload, 'shape': 'square', 'size': 1024}).status_code == 200
for patch in ({'text2': ''}, {'text2': 4}, {'family2': 'missing'}, {'family2': []}, {'text2': 'x' * 65}):
    assert client.post('/render', json={**payload, 'shape': 'square', **patch}).status_code in (400, 404)
print('PASS: mixed fonts, all shapes, gradients, formatting, export, invalid input')
