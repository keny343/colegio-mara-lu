import json
import urllib.request
import urllib.error

base = 'http://localhost:49152'
creds = {'email': 'admin@gmail.com', 'senha': '123456'}
headers = {'Content-Type': 'application/json'}

with open('tmp_endpoint_test_results.txt', 'w', encoding='utf-8') as out:
    def safe_print(*args, **kwargs):
        print(*args, **kwargs, file=out)

    req = urllib.request.Request(base + '/api/auth/login', data=json.dumps(creds).encode('utf-8'), headers=headers)
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode('utf-8'))
        safe_print('LOGIN OK', data['usuario']['email'])
        token = data['token']
    except urllib.error.HTTPError as e:
        safe_print('LOGIN FAIL', e.code)
        safe_print(e.read().decode('utf-8'))
        raise SystemExit(1)

    jwt = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    endpoints = [
        '/api/auth/perfil',
        '/api/staff/cursos',
        '/api/staff/disciplinas',
        '/api/staff/turmas',
        '/api/staff/usuarios',
    ]

    for ep in endpoints:
        try:
            req = urllib.request.Request(base + ep, headers=jwt)
            resp = urllib.request.urlopen(req)
            body = resp.read().decode('utf-8')
            safe_print('\nENDPOINT', ep, 'STATUS', resp.status)
            safe_print(body[:1000])
        except urllib.error.HTTPError as e:
            safe_print('\nENDPOINT', ep, 'FAIL', e.code)
            safe_print(e.read().decode('utf-8'))
