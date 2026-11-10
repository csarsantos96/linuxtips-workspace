"""Live gateway regression with two real local accounts in the same tenant.
Usage: python3 tests/private-cards-smoke.py http://localhost:18081
Creates disposable test accounts/data; never run against production.
"""
import json
import sys
import uuid
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

base = sys.argv[1].rstrip('/')
assert urlparse(base).hostname in ('localhost', '127.0.0.1'), 'Local disposable stack only'
checks = 0

def call(method, path, body=None, token=None, expected=200, extra=None):
    global checks
    headers = {'Content-Type': 'application/json', **(extra or {})}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = Request(base + path, method=method, headers=headers,
                  data=None if body is None else json.dumps(body).encode())
    try:
        response = urlopen(req, timeout=15)
    except HTTPError as err:
        response = err
    data = response.read()
    assert response.status == expected, f'{method} {path}: expected {expected}, got {response.status}'
    checks += 1
    print(f'OK {method} {path} {expected}')
    return json.loads(data) if data else None

suffix = uuid.uuid4().hex
accounts = []
for name in ('owner', 'peer'):
    accounts.append(call('POST', '/api/auth/signup', {
        'name': name, 'email': f'{name}-{suffix}@example.test',
        'password': 'Local-Isolation-QA-2026!', 'tenant_slug': 'isolation-' + suffix,
    }, expected=201))
owner, peer = accounts
assert owner['user']['tenant_id'] == peer['user']['tenant_id']
a, b = owner['token'], peer['token']
private = call('POST', '/api/cards/decks', {'name': 'Private QA', 'is_public': False}, a, 201)
public = call('POST', '/api/cards/decks', {'name': 'Public QA', 'is_public': True}, a, 201)
def new_card(deck, front):
    return call('POST', f"/api/cards/decks/{deck['id']}/cards", {'front': front, 'back': 'QA answer'}, a, 201)
secret = new_card(private, 'Private content')
shared = new_card(public, 'Public content')
stale = new_card(public, 'Known ID before revocation')
assert secret['id'] not in [x['id'] for x in call('GET', '/api/cards/review/due', token=b)]
assert call('GET', f"/api/cards/review/due?deck_id={private['id']}", token=b) == []
assert call('GET', '/api/cards/review/due?limit=1', token=b)[0]['id'] in (shared['id'], stale['id'])
before = call('GET', f"/api/cards/decks/{private['id']}/cards", token=a)
call('POST', f"/api/cards/cards/{secret['id']}/review", {'quality': 5}, b, 403)
# Client-controlled identity headers must not impersonate the owner through the gateway.
call('POST', f"/api/cards/cards/{secret['id']}/review", {'quality': 5}, b, 403,
     {'x-user-id': owner['user']['id'], 'x-tenant-id': owner['user']['tenant_id']})
assert call('GET', f"/api/cards/decks/{private['id']}/cards", token=a) == before
assert call('GET', '/api/cards/stats/retention', token=b)['total_reviews'] == 0
call('GET', f"/api/cards/decks/{private['id']}/cards", token=b, expected=403)
call('PATCH', f"/api/cards/cards/{secret['id']}", {'front': 'attack'}, b, 403)
call('DELETE', f"/api/cards/cards/{secret['id']}", token=b, expected=403)
assert call('POST', f"/api/cards/cards/{secret['id']}/review", {'quality': 5}, a)['card']['id'] == secret['id']
assert call('POST', f"/api/cards/cards/{shared['id']}/review", {'quality': 5}, b)['card']['id'] == shared['id']
call('PATCH', f"/api/cards/decks/{public['id']}", {'is_public': False}, a)
assert call('GET', f"/api/cards/review/due?deck_id={public['id']}", token=b) == []
call('POST', f"/api/cards/cards/{stale['id']}/review", {'quality': 5}, b, 403)
assert call('GET', '/api/cards/stats/retention', token=b)['total_reviews'] == 1
# Owner still retains access after privatization.
assert call('POST', f"/api/cards/cards/{stale['id']}/review", {'quality': 5}, a)['card']['id'] == stale['id']
print(f'PASS {checks} HTTP checks; two same-tenant accounts, private isolation and public control')
