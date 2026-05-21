require('dotenv').config();
const express = require('express');
const path = require('path');
const rconService = require('./services/rconService');

const app = express();
const PORT = process.env.PORT || 3000;

// DRY_RUN defaults to true if not set. Set DRY_RUN=false to enable live RCON execution.
const DRY_RUN = (process.env.DRY_RUN || 'true').toLowerCase() === 'true';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'docs')));

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
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FarmorOps server listening on http://localhost:${PORT}`);
});
