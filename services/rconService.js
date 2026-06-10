const { Rcon } = require('rcon-client');

const RCON_HOST = process.env.RCON_HOST || '127.0.0.1';
const RCON_PORT = parseInt(process.env.RCON_PORT, 10) || 27015;
const RCON_PASSWORD = process.env.RCON_PASSWORD || '';
const DEFAULT_TIMEOUT = 5000;

async function executeCommand(command) {
  if (!RCON_PASSWORD) {
    throw new Error('RCON password not configured');
  }

  const conn = new Rcon({ host: RCON_HOST, port: RCON_PORT, password: RCON_PASSWORD });
  let rejectSocketError;
  const socketError = new Promise((_, reject) => {
    rejectSocketError = reject;
  });
  socketError.catch(() => {});
  const onError = (err) => {
    const error = err instanceof Error ? err : new Error(String(err || 'RCON socket error'));
    console.error('[RCON] socket error:', error.message);
    rejectSocketError(error);
  };

  conn.on('error', onError);

  try {
    await Promise.race([
      conn.connect(),
      socketError
    ]);
    const result = await Promise.race([
      conn.send(command),
      socketError,
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
