const http = require('http');
const https = require('https');
const { URL } = require('url');

const CS_SERVER_API_BASE_URL = process.env.CS_SERVER_API_BASE_URL || 'https://mkbi.chickenkiller.com:27999';
const CS_SERVER_API_KEY = process.env.CS_SERVER_API_KEY || 'dev-secret-change-me';
const CS_SERVER_API_TIMEOUT_MS = parseInt(process.env.CS_SERVER_API_TIMEOUT_MS, 10) || 10000;

const baseUrl = new URL(CS_SERVER_API_BASE_URL);

class CsApiError extends Error {
  constructor(status, message, responseBody) {
    super(message);
    this.name = 'CsApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

function buildHeaders(body) {
  const headers = {
    Authorization: `Bearer ${CS_SERVER_API_KEY}`,
    Accept: 'application/json'
  };

  if (body != null) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return headers;
}

function logRequest(endpoint, method, href, body) {
  const sanitizedBody = body ? body : '<empty>';
  const maskedKey = CS_SERVER_API_KEY ? '*****' : '<missing>';

  console.info(`[CS API] REQUEST endpoint=${endpoint} method=${method}`);
  console.info(`[CS API] REQUEST url=${href}`);
  console.info(`[CS API] REQUEST HEADERS Authorization: Bearer ${maskedKey}`);
  console.info(`[CS API] REQUEST BODY ${sanitizedBody}`);
}

function logResponse(status, responseText) {
  console.info(`[CS API] RESPONSE status=${status}`);
  if (responseText) {
    console.info(`[CS API] RESPONSE BODY ${responseText}`);
  }
}

function parseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}

function sendHttpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const payload = parseJson(raw);
        logResponse(res.statusCode, raw);

        if (res.statusCode >= 400) {
          return reject(new CsApiError(res.statusCode, payload?.message || `CS API returned ${res.statusCode}`, payload));
        }

        return resolve(payload);
      });
    });

    req.on('error', (err) => {
      reject(new CsApiError(502, `CS API connection failed: ${err.message}`, null));
    });

    req.setTimeout(CS_SERVER_API_TIMEOUT_MS, () => {
      req.destroy();
      reject(new CsApiError(504, 'CS API timed out', null));
    });

    if (body != null) {
      req.write(body);
    }

    req.end();
  });
}

async function request(path, method, payload) {
  const url = new URL(path, baseUrl);
  const body = payload != null ? JSON.stringify(payload) : null;
  const headers = buildHeaders(body);
  const options = {
    method,
    headers
  };

  logRequest(path, method, url.href, body);
  return sendHttpRequest(url, options, body);
}

async function getMaps() {
  return request('/api/v1/maps', 'GET');
}

async function getMapCycle() {
  return request('/api/v1/mapcycle', 'GET');
}

async function updateMapCycle(maps) {
  return request('/api/v1/mapcycle', 'PUT', { maps });
}

async function getServerStatus() {
  return request('/api/v1/server/status', 'GET');
}

async function sendServerCommand(type, payload) {
  let body = { type };

  if (payload != null && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.arguments && typeof payload.arguments === 'object') {
      body.arguments = payload.arguments;
    } else if (Object.keys(payload).length > 0) {
      body.arguments = payload;
    }
  }

  return request('/api/v1/server/commands', 'POST', body);
}

async function sendServerCommandBody(body) {
  return request('/api/v1/server/commands', 'POST', body);
}

module.exports = {
  CsApiError,
  getMaps,
  getMapCycle,
  updateMapCycle,
  getServerStatus,
  sendServerCommand,
  sendServerCommandBody
};
