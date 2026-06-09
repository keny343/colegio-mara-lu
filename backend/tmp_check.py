import urllib.request

url = 'http://localhost:49152/api/staff/cursos'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as resp:
    body = resp.read()
    print('status', resp.status)
    print('bytes', body[:200])
    print('decoded utf-8:', body.decode('utf-8', errors='replace')[:200])
    print('decoded latin1:', body.decode('latin1', errors='replace')[:200])
