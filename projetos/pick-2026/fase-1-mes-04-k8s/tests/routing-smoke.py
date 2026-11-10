"""Smoke de integração: somente stack local descartável; cria dados de teste.
Uso: python3 tests/routing-smoke.py http://localhost:8080
"""
import json
import sys
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse

base = sys.argv[1].rstrip('/')
assert urlparse(base).hostname in ('localhost', '127.0.0.1'), 'Use somente ambiente local descartável'
token = None
checks = 0

def call(method, path, body=None, status=200, anonymous=False):
    global checks
    headers = {'Content-Type': 'application/json'}
    if token and not anonymous:
        headers['Authorization'] = 'Bearer ' + token
    req = Request(base + path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
    try:
        res = urlopen(req, timeout=15)
    except HTTPError as err:
        res = err
    data = res.read()
    assert res.status == status, f'{method} {path}: esperado {status}, recebido {res.status}'
    checks += 1
    print(f'OK {method} {path} {status}')
    return json.loads(data) if data else None

suffix = uuid.uuid4().hex[:10]
email = f'routing-{suffix}@example.test'
password = 'Local-Routing-QA-2026!'
call('GET', '/readyz')
call('GET', '/api/focus/sessions', status=401, anonymous=True)
signup = call('POST', '/api/auth/signup', {'email': email, 'password': password, 'name': 'Routing QA'}, 201)
login = call('POST', '/api/auth/login', {'email': email, 'password': password})
token = login['token']
assert call('GET', '/api/auth/me')['user']['id'] == signup['user']['id']
assert call('POST', '/api/auth/verify', {'token': token})['valid']
session = call('POST', '/api/focus/sessions/start', {'type': 'custom', 'duration_min': 1}, 201)
assert session['plannedDurationS'] == 60 and session['startedAt']
assert call('POST', f"/api/focus/sessions/{session['id']}/end", {})['status'] == 'completed'
assert any(s['id'] == session['id'] for s in call('GET', '/api/focus/sessions')['items'])
assert any(s['id'] == session['id'] for s in call('GET', '/api/focus/sessions/today')['items'])
deck = call('POST', '/api/cards/decks', {'name': 'Routing QA'}, 201)
card = call('POST', f"/api/cards/decks/{deck['id']}/cards", {'front': 'Docker?', 'back': 'Containers'}, 201)
assert call('GET', f"/api/cards/decks/{deck['id']}")['card_count'] == 1
assert any(c['id'] == card['id'] for c in call('GET', f"/api/cards/review/due?deck_id={deck['id']}&limit=20"))
review = call('POST', f"/api/cards/cards/{card['id']}/review", {'quality': 5})
assert review['interval_days'] >= 1
rm = call('POST', '/api/trilha/roadmaps', {'name': 'Routing QA', 'nodes': [{'external_id': 'root', 'title': 'Primeira etapa'}, {'external_id': 'child', 'title': 'Próxima etapa', 'depends_on': ['root']}]}, 201)
detail = call('GET', f"/api/trilha/roadmaps/{rm['id']}")
assert len(detail['nodes']) == 2
node = detail['nodes'][0]
call('PATCH', f"/api/trilha/nodes/{node['id']}/progress", {'status': 'learning'})
call('PATCH', f"/api/trilha/nodes/{node['id']}/progress", {'status': 'done'})
detail = call('GET', f"/api/trilha/roadmaps/{rm['id']}")
assert next(n for n in detail['nodes'] if n['id'] == node['id'])['progress']['status'] == 'done'
rotated = call('POST', '/api/auth/refresh', {'refresh_token': login['refresh_token']})
token = rotated['token']
call('GET', '/api/cards/decks')
call('POST', '/api/auth/refresh', {'refresh_token': login['refresh_token']}, 401)
call('POST', '/api/auth/logout', {'refresh_token': rotated['refresh_token']}, 204)
call('POST', '/api/auth/refresh', {'refresh_token': rotated['refresh_token']}, 401)
# Login ambíguo precisa selecionar tenant; nenhuma conta deve ser escolhida arbitrariamente.
for tenant in ('a-' + suffix, 'b-' + suffix):
    call('POST', '/api/auth/signup', {'email': 'shared-' + email, 'password': password, 'tenant_slug': tenant}, 201, anonymous=True)
assert call('POST', '/api/auth/login', {'email': 'shared-' + email, 'password': password}, 400, anonymous=True)['code'] == 'TENANT_REQUIRED'
call('POST', '/api/auth/login', {'email': 'shared-' + email, 'password': password, 'tenant_slug': 'b-' + suffix}, anonymous=True)
print(f'PASS {checks} verificações HTTP + persistência e isolamento do login')
