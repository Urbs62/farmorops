const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

async function withCsServerService(t, handler) {
  const receivedRequests = [];
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      receivedRequests.push({
        method: req.method,
        path: req.url,
        body: Buffer.concat(chunks).toString('utf8')
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'BOTCONTROL',
        accepted: true,
        message: 'Bot Control is ON. Min: 6. Max: 10'
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

  await handler(csServerService, receivedRequests);
}

test('setStaticBotQuota sends the exact BOTCONTROL static payload', async (t) => {
  await withCsServerService(t, async (csServerService, receivedRequests) => {
    const result = await csServerService.setStaticBotQuota(8);

    assert.deepEqual(receivedRequests, [{
      method: 'POST',
      path: '/api/v1/server/commands',
      body: '{"type":"BOTCONTROL","arguments":{"type":"static","bots":8}}'
    }]);
    assert.equal(result.accepted, true);
  });
});

test('sendDynamicBotControl sends exact dynamic BOTCONTROL payloads', async (t) => {
  await withCsServerService(t, async (csServerService, receivedRequests) => {
    await csServerService.sendDynamicBotControl('min', 6);
    await csServerService.sendDynamicBotControl('max', 10);
    await csServerService.sendDynamicBotControl('on');
    await csServerService.sendDynamicBotControl('status');
    await csServerService.sendDynamicBotControl('add_ct');
    await csServerService.sendDynamicBotControl('add_t');
    await csServerService.sendDynamicBotControl('del_ct');
    await csServerService.sendDynamicBotControl('del_t');
    await csServerService.sendDynamicBotControl('off');

    assert.deepEqual(receivedRequests, [
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"min","bots":6}}'
      },
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"max","bots":10}}'
      },
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"on"}}'
      },
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"status"}}'
      },
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"add_ct"}}'
      },
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"add_t"}}'
      },
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"del_ct"}}'
      },
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"del_t"}}'
      },
      {
        method: 'POST',
        path: '/api/v1/server/commands',
        body: '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"off"}}'
      }
    ]);
  });
});
