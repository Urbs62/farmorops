const csServerApiClient = require('./csServerApiClient');

async function getAllMaps() {
  return csServerApiClient.getMaps();
}

async function changeMap(mapId) {
  if (!mapId || typeof mapId !== 'string') {
    throw new Error('mapId is required and must be a string.');
  }

  try {
    return await csServerApiClient.sendServerCommand('CHANGE_MAP', { map: mapId });
  } catch (err) {
    if (!err || err.status !== 400) {
      throw err;
    }

    return csServerApiClient.sendServerCommandBody({
      type: 'CHANGE_MAP',
      map: mapId
    });
  }
}

async function restartMatch() {
  return csServerApiClient.sendServerCommand('RESTART_MATCH');
}

async function togglePause() {
  return csServerApiClient.sendServerCommand('TOGGLE_PAUSE');
}

async function setStaticBotQuota(bots) {
  return csServerApiClient.sendServerCommand('BOTCONTROL', {
    type: 'static',
    bots
  });
}

async function sendDynamicBotControl(command, bots) {
  const argumentsPayload = {
    type: 'dynamic',
    command
  };

  if (bots !== undefined) {
    argumentsPayload.bots = bots;
  }

  return csServerApiClient.sendServerCommand('BOTCONTROL', argumentsPayload);
}

async function getServerStatus() {
  return csServerApiClient.getServerStatus();
}

async function sendServerMessage(message) {
  if (!message || typeof message !== 'string') {
    throw new Error('message is required and must be a string.');
  }
  return csServerApiClient.sendServerCommand('SAY', { message });
}

async function getMapCycle() {
  return csServerApiClient.getMapCycle();
}

async function updateMapCycle(maps) {
  if (!Array.isArray(maps)) {
    throw new Error('maps must be an array of strings.');
  }
  return csServerApiClient.updateMapCycle(maps);
}

async function execConfig(config) {
  if (!config || typeof config !== 'string') {
    throw new Error('config is required and must be a string.');
  }
  return csServerApiClient.sendServerCommand('EXEC_CONFIG', { arguments: { config } });
}

module.exports = {
  getAllMaps,
  changeMap,
  restartMatch,
  togglePause,
  setStaticBotQuota,
  sendDynamicBotControl,
  getServerStatus,
  sendServerMessage,
  getMapCycle,
  updateMapCycle,
  execConfig
};
