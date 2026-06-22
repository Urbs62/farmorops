const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('togglePause sends the exact argument-free CS API command', async (t) => {
  let receivedRequest;
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      receivedRequest = {
        method: req.method,
        path: req.url,
        body: Buffer.concat(chunks).toString('utf8')
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'TOGGLE_PAUSE',
        accepted: true,
        message: 'RCON command executed'
      }));
    });
  });

  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => upstream.close(resolve)));

  const previousBaseUrl = process.env.CS_SERVER_API_BASE_URL;
  const previousApiKey = process.env.CS_SERVER_API_KEY;
  process.env.CS_SERVER_API_BASE_URL = `http://127.0.0.1:${upstream.address().port}`;
  process.env.CS_SERVER_API_KEY = 'test-key';
  t.after(() => {
    if (previousBaseUrl === undefined) delete process.env.CS_SERVER_API_BASE_URL;
    else process.env.CS_SERVER_API_BASE_URL = previousBaseUrl;
    if (previousApiKey === undefined) delete process.env.CS_SERVER_API_KEY;
    else process.env.CS_SERVER_API_KEY = previousApiKey;
  });

  delete require.cache[require.resolve('../services/csServerApiClient')];
  delete require.cache[require.resolve('../services/csServerService')];
  const csServerService = require('../services/csServerService');

  const result = await csServerService.togglePause();

  assert.deepEqual(receivedRequest, {
    method: 'POST',
    path: '/api/v1/server/commands',
    body: '{"type":"TOGGLE_PAUSE"}'
  });
  assert.equal(result.accepted, true);
});
