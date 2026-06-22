require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs/promises');
const rconService = require('./services/rconService');
const csServerService = require('./services/csServerService');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const ENABLE_LEGACY_COMMANDS = process.env.ENABLE_LEGACY_COMMANDS === 'true';
const CS_SERVER_API_BASE_URL = process.env.CS_SERVER_API_BASE_URL || process.env.CS_SERVER_BASE_URL || '';
const CS_SERVER_API_KEY = process.env.CS_SERVER_API_KEY || '';
const DATA_DIR = path.join(__dirname, 'data');
const FARMOROPS_STATE_FILE = path.join(DATA_DIR, 'farmorops-state.json');
const EMPTY_MAP_STATE = {
  availableMaps: [],
  selectableMaps: [],
  tonightMapCycle: [],
  tonightMapProgress: {
    playedMaps: [],
    currentMap: ''
  }
};

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';

const missingEnvVars = [];
if (!ADMIN_USERNAME.trim()) missingEnvVars.push('ADMIN_USERNAME');
if (!ADMIN_PASSWORD.trim()) missingEnvVars.push('ADMIN_PASSWORD');
if (!SESSION_SECRET.trim()) missingEnvVars.push('SESSION_SECRET');
if (!CS_SERVER_API_BASE_URL.trim()) missingEnvVars.push('CS_SERVER_API_BASE_URL or CS_SERVER_BASE_URL');
if (!CS_SERVER_API_KEY.trim()) missingEnvVars.push('CS_SERVER_API_KEY');

if (missingEnvVars.length) {
  console.error(`ERROR: Missing required env var(s): ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const USE_REMOTE_CS_API = Boolean(CS_SERVER_API_BASE_URL && CS_SERVER_API_BASE_URL.trim());
const USE_LOCAL_RCON = !USE_REMOTE_CS_API;

if (USE_LOCAL_RCON) {
  console.info('Using local RCON for CS commands because CS_SERVER_API_BASE_URL is not configured.');
}

// DRY_RUN defaults to true if not set. Set DRY_RUN=false to enable live RCON execution.
const DRY_RUN = (process.env.DRY_RUN || 'true').toLowerCase() === 'true';
let inferredMatchPaused = false;

function getLocalMapCommand(mapId) {
  const workshopMatch = String(mapId).match(/^workshop:(\d+)$/);
  if (workshopMatch) {
    return `host_workshop_map ${workshopMatch[1]}`;
  }

  if (/^\d+$/.test(mapId)) {
    return `host_workshop_map ${mapId}`;
  }

  return `changelevel ${mapId}`;
}

async function executeLocalCommand(command) {
  if (DRY_RUN) {
    return { execute: false, command, preview: `Local RCON preview: ${command}` };
  }

  const result = await rconService.executeCommand(command);
  return { execute: true, command, result: result || 'OK' };
}

function normalizeMapStatePayload(payload) {
  const state = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  const tonightMapCycle = Array.isArray(state.tonightMapCycle) ? state.tonightMapCycle : [];
  const progress = state.tonightMapProgress && typeof state.tonightMapProgress === 'object' && !Array.isArray(state.tonightMapProgress)
    ? state.tonightMapProgress
    : {};
  const playedMaps = Array.isArray(progress.playedMaps)
    ? progress.playedMaps.filter(map => typeof map === 'string' && tonightMapCycle.includes(map))
    : [];
  const currentMap = typeof progress.currentMap === 'string' && tonightMapCycle.includes(progress.currentMap)
    ? progress.currentMap
    : '';

  const normalizeStoredMaps = maps => Array.isArray(maps)
    ? maps.map(map => ({
      ...map,
      favorite: map && map.favorite === true
    }))
    : [];

  return {
    availableMaps: normalizeStoredMaps(state.availableMaps),
    selectableMaps: normalizeStoredMaps(state.selectableMaps),
    tonightMapCycle,
    tonightMapProgress: {
      playedMaps: [...new Set(playedMaps)],
      currentMap
    }
  };
}

function isValidStoredMap(map) {
  return map
    && typeof map === 'object'
    && !Array.isArray(map)
    && typeof map.name === 'string'
    && typeof map.type === 'string'
    && typeof map.value === 'string';
}

function isValidMapState(state) {
  return Array.isArray(state.availableMaps)
    && state.availableMaps.every(isValidStoredMap)
    && Array.isArray(state.selectableMaps)
    && state.selectableMaps.every(isValidStoredMap)
    && Array.isArray(state.tonightMapCycle)
    && state.tonightMapCycle.every(map => typeof map === 'string')
    && state.tonightMapProgress
    && typeof state.tonightMapProgress === 'object'
    && !Array.isArray(state.tonightMapProgress)
    && Array.isArray(state.tonightMapProgress.playedMaps)
    && state.tonightMapProgress.playedMaps.every(map => typeof map === 'string')
    && typeof state.tonightMapProgress.currentMap === 'string';
}

async function readFarmorOpsMapState() {
  try {
    const content = await fs.readFile(FARMOROPS_STATE_FILE, 'utf8');
    const parsed = JSON.parse(content);
    const state = normalizeMapStatePayload(parsed);
    return isValidMapState(state) ? state : { ...EMPTY_MAP_STATE };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { ...EMPTY_MAP_STATE };
    }
    throw err;
  }
}

async function writeFarmorOpsMapState(state) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${FARMOROPS_STATE_FILE}.tmp`;
  await fs.writeFile(tmpFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(tmpFile, FARMOROPS_STATE_FILE);
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction
    }
  })
);

function isAuthenticated(req) {
  return req.session && req.session.authenticated === true;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

function requireGuest(req, res, next) {
  if (isAuthenticated(req)) {
    return res.redirect('/');
  }
  next();
}

app.get('/login', requireGuest, (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'login.html'));
});

app.post('/login', requireGuest, (req, res) => {
  const { username, password } = req.body || {};

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/');
  }

  const error = encodeURIComponent('Felaktigt användarnamn eller lösenord.');
  return res.redirect(`/login?error=${error}`);
});

app.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    if (!isAuthenticated(req)) {
      return res.redirect('/login');
    }
  }
  next();
});

app.get('/CLIENT_API.md', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'docs', 'CLIENT_API.md'));
});

app.use(express.static(path.join(__dirname, 'docs')));

app.use('/api', requireAuth);

app.get('/api/state/maps', async (req, res) => {
  try {
    const state = await readFarmorOpsMapState();
    return res.json(state);
  } catch (err) {
    console.error('Failed to read FarmorOps map state:', err);
    return res.status(500).json({ error: 'Failed to read FarmorOps map state.' });
  }
});

app.put('/api/state/maps', async (req, res) => {
  const state = normalizeMapStatePayload(req.body);

  if (!isValidMapState(state)) {
    return res.status(400).json({
      error: 'State must contain availableMaps, selectableMaps, and tonightMapCycle arrays.'
    });
  }

  try {
    await writeFarmorOpsMapState(state);
    return res.json(state);
  } catch (err) {
    console.error('Failed to save FarmorOps map state:', err);
    return res.status(500).json({ error: 'Failed to save FarmorOps map state.' });
  }
});

app.get('/api/cs/maps', async (req, res) => {
  try {
    const maps = await csServerService.getAllMaps();
    res.json(maps);
  } catch (err) {
    return handleCsApiError(err, res);
  }
});

app.post('/api/cs/change-map', async (req, res) => {
  const { mapId } = req.body || {};

  if (!mapId || typeof mapId !== 'string') {
    return res.status(400).json({ error: 'mapId is required and must be a string.' });
  }

  try {
    if (USE_LOCAL_RCON) {
      const result = await executeLocalCommand(getLocalMapCommand(mapId));
      inferredMatchPaused = false;
      return res.json({ success: true, ...result });
    }

    const result = await csServerService.changeMap(mapId);
    inferredMatchPaused = false;
    return res.json({ success: true, result });
  } catch (err) {
    return handleCsApiError(err, res);
  }
});

app.post('/api/cs/restart-match', async (req, res) => {
  try {
    if (USE_LOCAL_RCON) {
      const result = await executeLocalCommand('mp_restartgame 1');
      inferredMatchPaused = false;
      return res.json({ success: true, ...result });
    }

    const result = await csServerService.restartMatch();
    inferredMatchPaused = false;
    return res.json({ success: true, result });
  } catch (err) {
    return handleCsApiError(err, res);
  }
});

app.post('/api/cs/toggle-pause', async (req, res) => {
  const endpoint = 'POST /api/cs/toggle-pause';
  console.info(`[FarmorOps] endpoint called: ${endpoint}`);

  try {
    let result;

    if (USE_LOCAL_RCON) {
      const command = inferredMatchPaused ? 'mp_unpause_match' : 'mp_pause_match';
      result = await executeLocalCommand(command);
    } else {
      result = await csServerService.togglePause();
    }

    inferredMatchPaused = !inferredMatchPaused;
    const body = { success: true, paused: inferredMatchPaused, result };
    console.info(`[FarmorOps] response status: 200 endpoint=${endpoint}`);
    console.info(`[FarmorOps] response body: ${JSON.stringify(body)}`);
    return res.json(body);
  } catch (err) {
    const isExpectedCsApiError = err
      && typeof err.status === 'number'
      && [400, 401, 403, 502, 504].includes(err.status);
    const status = isExpectedCsApiError ? err.status : 500;
    const body = isExpectedCsApiError
      ? (err.responseBody || { error: err.message || 'CS API request failed.' })
      : { error: 'Unexpected CS API error.' };
    if (!isExpectedCsApiError) {
      console.error('Unexpected CS API error:', err);
    }
    console.info(`[FarmorOps] response status: ${status} endpoint=${endpoint}`);
    console.info(`[FarmorOps] response body: ${JSON.stringify(body)}`);
    return res.status(status).json(body);
  }
});

app.get('/api/cs/status', async (req, res) => {
  try {
    const status = await csServerService.getServerStatus();
    return res.json({
      ...status,
      commandMode: USE_LOCAL_RCON ? 'local-preview' : 'remote',
      dryRun: DRY_RUN,
      localRcon: USE_LOCAL_RCON
    });
  } catch (err) {
    return handleCsApiError(err, res);
  }
});

app.get('/api/cs/mapcycle', async (req, res) => {
  if (USE_LOCAL_RCON) {
    return res.status(501).json({ error: 'Mapcycle read is not supported in local RCON mode.' });
  }

  try {
    const mapcycle = await csServerService.getMapCycle();
    return res.json(mapcycle);
  } catch (err) {
    return handleCsApiError(err, res);
  }
});

app.put('/api/cs/mapcycle', async (req, res) => {
  const { maps } = req.body || {};

  if (!Array.isArray(maps) || maps.some(map => typeof map !== 'string')) {
    return res.status(400).json({ error: 'maps is required and must be an array of strings.' });
  }

  if (USE_LOCAL_RCON) {
    return res.status(501).json({ error: 'Mapcycle update is not supported in local RCON mode.' });
  }

  try {
    const result = await csServerService.updateMapCycle(maps);
    return res.json(result);
  } catch (err) {
    return handleCsApiError(err, res);
  }
});

app.post('/api/cs/exec-config', async (req, res) => {
  const { config } = req.body || {};

  if (!config || typeof config !== 'string') {
    return res.status(400).json({ error: 'config is required and must be a string.' });
  }

  try {
    if (USE_LOCAL_RCON) {
      const result = await executeLocalCommand(`exec ${config}`);
      return res.json({ success: true, ...result });
    }

    const result = await csServerService.execConfig(config);
    return res.json({ success: true, result });
  } catch (err) {
    return handleCsApiError(err, res);
  }
});

app.post('/api/cs/send-message', async (req, res) => {
  const { message } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required and must be a string.' });
  }

  try {
    if (USE_LOCAL_RCON) {
      const result = await executeLocalCommand(`say ${message}`);
      return res.json({ success: true, ...result });
    }

    const result = await csServerService.sendServerMessage(message);
    return res.json({ success: true, result });
  } catch (err) {
    return handleCsApiError(err, res);
  }
});

function handleCsApiError(err, res) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const message = err && err.message ? err.message : 'CS API request failed.';
  const body = err && err.responseBody ? err.responseBody : { error: message };

  if ([400, 401, 403, 502, 504].includes(status)) {
    return res.status(status).json(body);
  }

  console.error('Unexpected CS API error:', err);
  return res.status(500).json({ error: 'Unexpected CS API error.' });
}

function normalizePayload(payload) {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
}

function buildRconCommand(action, payload) {
  const data = normalizePayload(payload);

  if (typeof data.command === 'string' && data.command.trim()) {
    return data.command.trim();
  }

  switch (action) {
    case 'set_bots':
      return `bot_quota ${data.count ?? data.value ?? 0}`;
    case 'change_map':
      return `changelevel ${data.map ?? data.value ?? ''}`.trim();
    case 'workshop_map':
      return `host_workshop_map ${data.id ?? data.value ?? ''}`.trim();
    default:
      return action;
  }
}

app.post('/api/command', (req, res) => {
  if (isProduction && !ENABLE_LEGACY_COMMANDS) {
    return res.status(403).json({ error: 'Legacy command endpoint is disabled in production.' });
  }

  const { action, payload } = req.body || {};

  if (typeof action !== 'string' || !action.trim()) {
    return res.status(400).json({
      error: 'Expected JSON body with a non-empty action string.'
    });
  }

  const command = buildRconCommand(action.trim(), payload);

  if (DRY_RUN) {
    // In dry-run mode we only return a preview and do not touch RCON.
    return res.json({ execute: false, command, preview: `RCON preview: ${command}` });
  }

  // Live execution via RCON
  (async () => {
    try {
      const result = await rconService.executeCommand(command);
      return res.json({ execute: true, command, result: result || 'OK' });
    } catch (err) {
      console.error('RCON execution error:', err && err.message ? err.message : err);
      return res.status(502).json({ error: 'Failed to execute command via RCON.' });
    }
  })();
});

app.get('*', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FarmorOps server listening on http://localhost:${PORT}`);
  console.log(`[CS API] Effective base URL: ${CS_SERVER_API_BASE_URL}`);
  console.log(`[CS API] Mode: ${USE_LOCAL_RCON ? 'local RCON' : 'remote CS API'}`);
});
