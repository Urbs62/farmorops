require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const rconService = require('./services/rconService');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';

if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_SECRET) {
  console.warn('WARNING: ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET must be set in .env for login to work.');
}

// DRY_RUN defaults to true if not set. Set DRY_RUN=false to enable live RCON execution.
const DRY_RUN = (process.env.DRY_RUN || 'true').toLowerCase() === 'true';

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax'
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

  if (req.method === 'GET') {
    return res.redirect('/login');
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

app.use(express.static(path.join(__dirname, 'docs')));

app.use('/api', requireAuth);

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
});
