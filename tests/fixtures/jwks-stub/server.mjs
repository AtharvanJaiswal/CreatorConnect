import http from 'node:http';

const TEST_PUBLIC_KEY_JWK = {
  kty: 'EC',
  x: 'qNPSXoEres5WqJm-dAQgayVZsh3roSw89tL8uQezp8A',
  y: '3gVnJzNHCwaRJXqfttI7hpcWzDxa6rMrmKPaKoyv5YQ',
  crv: 'P-256',
  kid: 'test-key-01',
};

const server = http.createServer((req, res) => {
  if (
    req.url === '/.well-known/jwks.json' ||
    req.url === '/auth/v1/.well-known/jwks.json'
  ) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify({ keys: [TEST_PUBLIC_KEY_JWK] }));
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const port = process.env.PORT || 8080;
const host = '0.0.0.0';

server.listen(port, host, () => {
  console.log(`JWKS stub listening on http://${host}:${port}`);
});
