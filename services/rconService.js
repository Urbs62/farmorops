const { Rcon } = require('rcon-client');

const RCON_HOST = process.env.RCON_HOST || '127.0.0.1';
const RCON_PORT = parseInt(process.env.RCON_PORT, 10) || 27015;
const RCON_PASSWORD = process.env.RCON_PASSWORD || '';
const DEFAULT_TIMEOUT = 5000;

async function executeCommand(command) {
  if (!RCON_PASSWORD) {
    throw new Error('RCON password not configured');
  }

  const conn = await Rcon.connect({ host: RCON_HOST, port: RCON_PORT, password: RCON_PASSWORD });
  try {
    const result = await Promise.race([
      conn.send(command),
      new Promise((_, reject) => setTimeout(() => reject(new Error('RCON timeout')), DEFAULT_TIMEOUT))
    ]);
    await conn.end();
    return result;
  } catch (err) {
    try { await conn.end(); } catch (_) {}
    throw err;
  }
}

module.exports = { executeCommand };
