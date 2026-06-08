const STORAGE_KEYS = {
  selectableMaps: 'farmorops_selectable_maps_v1',
  inventory: 'farmorops_inventory_maps_v1',
  cycle: 'farmorops.mapCycle'
};

const defaultMaps = [];

const defaultInventory = [
  { name: 'de_mirage', type: 'standard', value: 'de_mirage' },
  { name: 'de_inferno', type: 'standard', value: 'de_inferno' },
  { name: 'de_dust2', type: 'standard', value: 'de_dust2' },
  { name: 'de_nuke', type: 'standard', value: 'de_nuke' },
  { name: 'de_overpass', type: 'standard', value: 'de_overpass' },
  { name: 'de_ancient', type: 'standard', value: 'de_ancient' },
  { name: 'de_anubis', type: 'standard', value: 'de_anubis' },
  { name: 'cs_office', type: 'standard', value: 'cs_office' },
  { name: 'de_vertigo', type: 'standard', value: 'de_vertigo' },
  { name: 'fy_pool_day', type: 'workshop', value: '3070286877' },
  { name: 'awp_lego_2', type: 'workshop', value: '3070251264' }
];

function getMockFarmorInventory() {
  return [...defaultInventory];
}

function fetchAvailableInventory() {
  return Promise.resolve(getMockFarmorInventory());
}

let maps = loadStoredMaps();
let inventoryMaps = loadStoredInventory();
let cycle = loadStoredCycle();
let consoleLines = [];
let matchPaused = false;

const mapList = document.getElementById('mapList');
const inventoryList = document.getElementById('inventoryList');
const cycleList = document.getElementById('cycleList');
const consoleBox = document.getElementById('console');
const mapSearch = document.getElementById('mapSearch');
const refreshAvailableMapsBtn = document.getElementById('refreshAvailableMapsBtn');
const clearAvailableMapsBtn = document.getElementById('clearAvailableMapsBtn');
const importStatusEl = document.getElementById('importStatus');
const refreshServerStatusBtn = document.getElementById('refreshServerStatusBtn');
const csApiCurrentMap = document.getElementById('csApiCurrentMap');
const csApiOnlineStatus = document.getElementById('csApiOnlineStatus');
const csApiPlayerCount = document.getElementById('csApiPlayerCount');
const csApiPlayerList = document.getElementById('csApiPlayerList');
const csApiStatusMessage = document.getElementById('csApiStatusMessage');
const csApiModeBadge = document.getElementById('csApiModeBadge');
const csApiModeWarning = document.getElementById('csApiModeWarning');
const csApiResponseLog = document.getElementById('csApiResponseLog');
const csApiMapcycleWarning = document.getElementById('csApiMapcycleWarning');
const csApiMapSelect = document.getElementById('csApiMapSelect');
const csApiChangeMapBtn = document.getElementById('csApiChangeMapBtn');
const csApiGetMapcycleBtn = document.getElementById('csApiGetMapcycleBtn');
const csApiUpdateMapcycleBtn = document.getElementById('csApiUpdateMapcycleBtn');
const csApiWarmupBtn = document.getElementById('csApiWarmupBtn');
const csApiOrdinaryBtn = document.getElementById('csApiOrdinaryBtn');
const csApiRestartMatchBtn = document.getElementById('csApiRestartMatchBtn');
const csApiMessageInput = document.getElementById('csApiMessageInput');
const csApiSendMessageBtn = document.getElementById('csApiSendMessageBtn');

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    addCommand('# Could not save changes to localStorage');
  }
}

function isValidMap(map) {
  return map
    && typeof map.name === 'string'
    && typeof map.type === 'string'
    && typeof map.value === 'string';
}

function loadStoredCycle() {
  const savedCycle = readStorage(STORAGE_KEYS.cycle, []);
  return Array.isArray(savedCycle) && savedCycle.every(map => typeof map === 'string')
    ? savedCycle
    : [];
}

function saveMaps() {
  writeStorage(STORAGE_KEYS.selectableMaps, maps);
}

function saveInventory() {
  writeStorage(STORAGE_KEYS.inventory, inventoryMaps);
}

function setImportStatus(message, type = 'info') {
  if (!importStatusEl) return;
  importStatusEl.textContent = message;
  importStatusEl.style.color = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--ok)' : 'var(--text)';
}

function setServerStatusMessage(message, type = 'info') {
  if (!csApiStatusMessage) return;
  csApiStatusMessage.textContent = message;
  csApiStatusMessage.style.color = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--ok)' : 'var(--text)';
}

function setCsApiMapcycleWarning(message) {
  if (!csApiMapcycleWarning) return;
  csApiMapcycleWarning.textContent = message;
}

function setCsApiModeBadge(message, cssClass) {
  if (!csApiModeBadge) return;
  csApiModeBadge.textContent = message;
  csApiModeBadge.className = `mode-badge ${cssClass || ''}`.trim();
}

function setCsApiModeWarning(message) {
  if (!csApiModeWarning) return;
  csApiModeWarning.textContent = message;
}

function appendCsApiResponseLog(title, response, body) {
  if (!csApiResponseLog) return;
  const timestamp = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const statusText = response ? `${response.status} ${response.statusText || ''}` : 'NETWORK ERROR';
  const header = `[${timestamp}] ${title} — ${statusText}`;
  const bodyText = body != null ? JSON.stringify(body, null, 2) : '<no body>';
  csApiResponseLog.textContent = `${header}\n${bodyText}\n\n${csApiResponseLog.textContent || ''}`;
}

function renderAvailableMapOptions() {
  if (!csApiMapSelect) return;

  const options = inventoryMaps.map(map => {
    const title = map.type === 'workshop'
      ? `${map.name} (WORKSHOP)`
      : `${map.name} (BUILTIN)`;
    const key = getMapKey(map);
    const disabled = map.unavailable || !key ? 'disabled' : '';
    return `
      <option value="${key}" ${disabled}>${title}</option>
    `;
  }).join('');

  csApiMapSelect.innerHTML = `<option value="">Choose an available map</option>${options}`;
}

function syncSelectedMapToInput() {
  if (!csApiMapSelect || !csApiChangeMapBtn) return;
  const selected = csApiMapSelect.value;
  if (selected) {
    const input = document.getElementById('csApiChangeMapInput');
    if (input) input.value = selected;
  }
}

function renderServerStatus(status) {
  if (csApiCurrentMap) {
    csApiCurrentMap.textContent = status?.currentMap || '—';
  }

  if (csApiOnlineStatus) {
    csApiOnlineStatus.textContent = status?.online ? 'Online' : 'Offline';
  }

  if (csApiPlayerCount) {
    const playerCount = typeof status?.playerCount === 'number' ? status.playerCount : 0;
    const maxPlayers = typeof status?.maxPlayers === 'number' ? status.maxPlayers : 0;
    csApiPlayerCount.textContent = `${playerCount} / ${maxPlayers}`;
  }

  if (csApiPlayerList) {
    const players = Array.isArray(status?.players) ? status.players : [];
    if (!players.length) {
      csApiPlayerList.innerHTML = '<div class="player-item">No players connected.</div>';
      return;
    }

    csApiPlayerList.innerHTML = players.map(player => `
      <div class="player-item">
        <strong>${player.name}</strong>
        <small>${player.steamId}</small>
        <div>${player.score} pts · ${player.durationSeconds}s</div>
      </div>
    `).join('');
  }
}

function getMapKey(map) {
  return map.id || map.value || map.name || '';
}

function normalizeServerMap(map) {
  if (!map || typeof map !== 'object') return null;

  const isWorkshop = map.source === 'WORKSHOP';
  const value = isWorkshop ? (map.workshopId || map.name) : map.name;

  return {
    id: map.id || map.name,
    name: map.displayName || map.name,
    type: isWorkshop ? 'workshop' : 'standard',
    value,
    origin: map.source,
    validForMapCycle: Boolean(map.validForMapCycle),
    unavailable: false
  };
}

function areMapsEqual(existing, imported) {
  if (existing.id && imported.id) {
    return existing.id === imported.id;
  }
  return existing.name === imported.name || existing.value === imported.value;
}

function updateAvailableMapsFromServer(items) {
  const imported = items
    .map(normalizeServerMap)
    .filter(map => map && map.name && map.value);

  const serverKeys = new Set(imported.map(getMapKey));
  const merged = imported.map((incoming) => {
    const duplicate = inventoryMaps.find(existing => areMapsEqual(existing, incoming));
    if (duplicate) {
      return { ...duplicate, ...incoming, unavailable: false };
    }
    return incoming;
  });

  const manualMaps = inventoryMaps.filter(map => !map.origin);
  manualMaps.forEach((manual) => {
    if (!merged.some(existing => areMapsEqual(existing, manual))) {
      merged.push(manual);
    }
  });

  const refreshed = merged.map((map) => {
    if (map.origin && !serverKeys.has(getMapKey(map))) {
      return { ...map, unavailable: true };
    }
    return { ...map, unavailable: false };
  });

  inventoryMaps = refreshed;
  saveInventory();

  maps = maps.map((map) => {
    if (map.origin && !serverKeys.has(getMapKey(map))) {
      return { ...map, unavailable: true };
    }
    return { ...map, unavailable: false };
  });
  saveMaps();
}

async function refreshServerStatus() {
  if (!refreshServerStatusBtn) return;
  refreshServerStatusBtn.disabled = true;
  setServerStatusMessage('Loading server status...', 'info');

  try {
    const response = await fetch('/api/cs/status', { credentials: 'include' });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Get server status', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Failed to load server status: ${response.status} ${errorMessage}`, 'error');
      return;
    }

    if (body?.commandMode) {
      if (body.commandMode === 'local-preview') {
        setCsApiModeBadge('Preview mode', 'preview');
        setCsApiModeWarning('WARNING: Commands are in local preview mode and are not executed. Set CS_SERVER_API_BASE_URL and/or DRY_RUN=false to use real server commands.');
      } else {
        setCsApiModeBadge('Live mode', 'live');
        setCsApiModeWarning('');
      }
    } else {
      setCsApiModeBadge('Unknown mode', 'warning');
      setCsApiModeWarning('');
    }

    renderServerStatus(body);
    setServerStatusMessage('Server status updated.', 'success');
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog('Get server status', null, { error: message });
    setServerStatusMessage(`Status error: ${message}`, 'error');
  } finally {
    refreshServerStatusBtn.disabled = false;
  }
}

async function changeServerMap(mapIdOverride) {
  let mapId = typeof mapIdOverride === 'string'
    ? mapIdOverride.trim()
    : '';

  if (!mapId) {
    if (csApiMapSelect && csApiMapSelect.value) {
      mapId = csApiMapSelect.value.trim();
    } else if (csApiChangeMapInput) {
      mapId = csApiChangeMapInput.value.trim();
    }
  }

  if (!mapId) {
    setServerStatusMessage('Map id is required.', 'error');
    return false;
  }

  if (csApiChangeMapBtn) {
    csApiChangeMapBtn.disabled = true;
  }

  try {
    const response = await fetch('/api/cs/change-map', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapId })
    });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Change map', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Change map failed: ${response.status} ${errorMessage}`, 'error');
      return false;
    }

    if (typeof mapIdOverride !== 'string' && csApiChangeMapInput) {
      csApiChangeMapInput.value = '';
    }

    setServerStatusMessage(`Map change requested: ${mapId}`, 'success');
    return true;
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog('Change map', null, { error: message });
    setServerStatusMessage(`Change map error: ${message}`, 'error');
    return false;
  } finally {
    if (csApiChangeMapBtn) {
      csApiChangeMapBtn.disabled = false;
    }
  }
}

async function restartMatchApi() {
  if (!csApiRestartMatchBtn) return;
  csApiRestartMatchBtn.disabled = true;

  try {
    const response = await fetch('/api/cs/restart-match', {
      method: 'POST',
      credentials: 'include'
    });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Restart match', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Restart match failed: ${response.status} ${errorMessage}`, 'error');
      return;
    }
    setServerStatusMessage('Restart match requested.', 'success');
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog('Restart match', null, { error: message });
    setServerStatusMessage(`Restart match error: ${message}`, 'error');
  } finally {
    if (csApiRestartMatchBtn) {
      csApiRestartMatchBtn.disabled = false;
    }
  }
}

async function sendServerMessage(messageOverride) {
  const message = (typeof messageOverride === 'string'
    ? messageOverride.trim()
    : csApiMessageInput?.value.trim() || '');

  if (!message) {
    setServerStatusMessage('Message text is required.', 'error');
    return false;
  }

  if (csApiSendMessageBtn) {
    csApiSendMessageBtn.disabled = true;
  }

  try {
    const response = await fetch('/api/cs/send-message', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Send message', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Send message failed: ${response.status} ${errorMessage}`, 'error');
      return false;
    }

    if (typeof messageOverride !== 'string' && csApiMessageInput) {
      csApiMessageInput.value = '';
    }

    setServerStatusMessage('Server message sent.', 'success');
    return true;
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog('Send message', null, { error: message });
    setServerStatusMessage(`Send message error: ${message}`, 'error');
    return false;
  } finally {
    if (csApiSendMessageBtn) {
      csApiSendMessageBtn.disabled = false;
    }
  }
}

async function getCurrentMapcycle() {
  if (!csApiGetMapcycleBtn) return;
  csApiGetMapcycleBtn.disabled = true;
  setCsApiMapcycleWarning('');

  try {
    const response = await fetch('/api/cs/mapcycle', { credentials: 'include' });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Get current mapcycle', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Get mapcycle failed: ${response.status} ${errorMessage}`, 'error');
      return;
    }

    setServerStatusMessage('Current mapcycle fetched.', 'success');
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog('Get current mapcycle', null, { error: message });
    setServerStatusMessage(`Get mapcycle error: ${message}`, 'error');
  } finally {
    csApiGetMapcycleBtn.disabled = false;
  }
}

async function updateMapcycle() {
  if (!csApiUpdateMapcycleBtn) return;
  csApiUpdateMapcycleBtn.disabled = true;
  setCsApiMapcycleWarning('');

  const activeMaps = maps || [];
  const workshopMaps = activeMaps.filter(map => map.type === 'workshop');
  const invalidMaps = activeMaps.filter(map => map.type !== 'workshop' && !map.validForMapCycle);
  const validMaps = activeMaps.filter(map => map.type !== 'workshop' && Boolean(map.validForMapCycle));

  if (workshopMaps.length || invalidMaps.length) {
    const warnings = [];
    if (workshopMaps.length) {
      warnings.push(`Skipped ${workshopMaps.length} WORKSHOP map(s) from update.`);
    }
    if (invalidMaps.length) {
      warnings.push(`Skipped ${invalidMaps.length} map(s) not valid for mapcycle.`);
    }
    setCsApiMapcycleWarning(warnings.join(' '));
  }

  if (!validMaps.length) {
    setServerStatusMessage('No valid active maps available for mapcycle update.', 'error');
    csApiUpdateMapcycleBtn.disabled = false;
    return;
  }

  const mapIds = validMaps.map(map => map.id || map.value || map.name).filter(Boolean);

  try {
    const response = await fetch('/api/cs/mapcycle', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maps: mapIds })
    });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Update mapcycle', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Update mapcycle failed: ${response.status} ${errorMessage}`, 'error');
      return;
    }

    setServerStatusMessage('Mapcycle updated successfully.', 'success');
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog('Update mapcycle', null, { error: message });
    setServerStatusMessage(`Update mapcycle error: ${message}`, 'error');
  } finally {
    if (csApiUpdateMapcycleBtn) {
      csApiUpdateMapcycleBtn.disabled = false;
    }
  }
}

async function execConfig(config, label) {
  if (!config || !csApiWarmupBtn || !csApiOrdinaryBtn) return;
  const button = label === 'wu' ? csApiWarmupBtn : csApiOrdinaryBtn;
  button.disabled = true;

  try {
    const response = await fetch('/api/cs/exec-config', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog(`Exec config ${config}`, response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Exec config failed: ${response.status} ${errorMessage}`, 'error');
      return;
    }

    setServerStatusMessage(`Exec config requested: ${config}`, 'success');
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog(`Exec config ${config}`, null, { error: message });
    setServerStatusMessage(`Exec config error: ${message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

async function refreshAvailableMaps() {
  if (!refreshAvailableMapsBtn) return;
  refreshAvailableMapsBtn.disabled = true;
  setImportStatus('Refreshing available maps from server...', 'info');

  try {
    const response = await fetch('/api/cs/maps', { credentials: 'include' });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Get maps', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setImportStatus(`Failed to refresh maps: ${response.status} ${errorMessage}`, 'error');
      return;
    }

    if (!Array.isArray(body)) {
      setImportStatus('Server returned invalid map list.', 'error');
      return;
    }

    updateAvailableMapsFromServer(body);
    renderInventory();
    renderMaps();
    setImportStatus(`Refreshed ${body.length} map(s) from server.`, 'success');
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    setImportStatus(`Refresh error: ${message}`, 'error');
  } finally {
    refreshAvailableMapsBtn.disabled = false;
  }
}

function clearAvailableMaps() {
  if (!clearAvailableMapsBtn) return;
  if (!confirm('Remove all maps from Available Maps?')) {
    return;
  }

  inventoryMaps = [];
  saveInventory();
  renderInventory();
  setImportStatus('Cleared all Available Maps.', 'success');
}

function saveCycle() {
  writeStorage(STORAGE_KEYS.cycle, cycle);
}

function isSelectableMap(map) {
  return maps.some(item => item.name === map.name);
}

function loadStoredInventory() {
  const savedInventory = readStorage(STORAGE_KEYS.inventory, null);
  return Array.isArray(savedInventory) && savedInventory.every(isValidMap)
    ? savedInventory
    : getMockFarmorInventory();
}

function loadStoredMaps() {
  let savedMaps = readStorage(STORAGE_KEYS.selectableMaps, null);
  if (savedMaps === null) {
    savedMaps = readStorage('farmorops.mapLibrary', null);
  }

  return Array.isArray(savedMaps) && savedMaps.every(isValidMap)
    ? savedMaps
    : [...defaultMaps];
}

function addInventoryMap(mapName) {
  const map = inventoryMaps.find(item => item.name === mapName);
  if (!map || isSelectableMap(map)) return;

  maps.push({ ...map, source: 'inventory' });
  saveMaps();
  renderMaps();
  renderInventory();
  addCommand(`# Added to selectable maps: ${map.name}`);
}

function removeSelectableMap(mapName) {
  const index = maps.findIndex(item => item.name === mapName);
  if (index === -1) return;

  maps.splice(index, 1);
  saveMaps();

  const removedFromCycle = cycle.includes(mapName);
  if (removedFromCycle) {
    cycle = cycle.filter(item => item !== mapName);
    saveCycle();
  }

  renderMaps();
  renderInventory();
  renderCycle();
  addCommand(`# Removed from selectable maps: ${mapName}`);
  if (removedFromCycle) {
    addCommand(`# Removed from tonight cycle: ${mapName}`);
  }
}

function renderInventory() {
  if (!inventoryList) return;

  inventoryList.innerHTML = inventoryMaps.map(map => {
    const selected = isSelectableMap(map);
    const badgeType = map.type === 'workshop' ? 'WORKSHOP' : 'BUILTIN';
    const badgeClass = map.type === 'workshop' ? 'workshop' : 'builtin';
    const mapCycleNote = map.type === 'workshop'
      ? '<div class="map-note">Workshop maps cannot be saved to mapcycle.</div>'
      : '<div class="map-note">Builtin maps may be used in mapcycle.</div>';
    const details = map.type === 'workshop'
      ? `Workshop ID: ${map.value}`
      : 'Standard map';
    const unavailableNote = map.unavailable
      ? '<div class="map-note map-note-unavailable">This map is no longer available on the Farmor server.</div>'
      : '';
    const buttonDisabled = selected || map.unavailable ? 'disabled' : '';
    const buttonLabel = map.unavailable ? 'Unavailable' : (selected ? 'Added' : 'Add');

    return `
      <div class="map-row">
        <div class="map-row-left">
          <div class="map-title-row">
            <span class="map-name">${map.name}</span>
            <span class="map-badge map-badge-${badgeClass}">${badgeType}</span>
          </div>
          <div class="map-meta">
            <small>${details}</small>
            ${mapCycleNote}
            ${unavailableNote}
          </div>
        </div>
        <button type="button" data-action="add-inventory" data-map="${map.name}" ${buttonDisabled}>
          ${buttonLabel}
        </button>
      </div>
    `;
  }).join('');

  renderAvailableMapOptions();
}

function renderMaps() {
  const query = mapSearch.value.toLowerCase().trim();
  const filtered = maps.filter(map => map.name.toLowerCase().includes(query) || map.value.toLowerCase().includes(query));

  if (!filtered.length) {
    mapList.innerHTML = '<div class="empty">No selectable maps yet. Add maps from Available on Farmor.</div>';
    return;
  }

  mapList.innerHTML = filtered.map(map => {
    const origin = map.source === 'inventory'
      ? '<span class="source-pill">Available on Farmor</span>'
      : '';
    const unavailableNote = map.unavailable
      ? '<div class="map-note map-note-unavailable">This map is no longer available on the Farmor server.</div>'
      : '';
    const addDisabled = map.unavailable ? 'disabled' : '';
    const addLabel = map.unavailable ? 'Unavailable' : 'Add';

    return `
      <div class="map-row">
        <div>
          <span class="map-name">${map.name}</span> ${origin}<br>
          <small style="color: var(--muted)">${map.type === 'workshop' ? 'Workshop ID: ' + map.value : 'Standard map'}</small>
          ${unavailableNote}
        </div>
        <div class="map-actions">
          <button onclick="addMapToCycle('${map.name}')" ${addDisabled}>${addLabel}</button>
          <button class="secondary" onclick="removeSelectableMap('${map.name}')">Remove</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderCycle() {
  if (!cycle.length) {
    cycleList.innerHTML = '<div class="empty">No maps selected yet. Add maps from the list on the left.</div>';
    return;
  }

  cycleList.innerHTML = cycle.map((map, index) => `
    <div class="cycle-item">
      <span class="nr">${index + 1}</span>
      <span class="map-name">${map}</span>
      <button class="secondary" onclick="loadMap('${map}')">Load</button>
      <button class="danger" onclick="removeMap(${index})">Remove</button>
    </div>
  `).join('');
}

function addMapToCycle(map) {
  if (!cycle.includes(map)) cycle.push(map);
  saveCycle();
  renderCycle();
  addCommand(`# Added to tonight cycle: ${map}`);
}

function removeMap(index) {
  const removed = cycle.splice(index, 1)[0];
  saveCycle();
  renderCycle();
  addCommand(`# Removed from tonight cycle: ${removed}`);
}

function clearMaps() {
  if (!confirm('Remove all maps from the active list and clear the mapcycle?')) {
    return;
  }

  maps = [];
  cycle = [];
  saveMaps();
  saveCycle();
  renderMaps();
  renderCycle();
  addCommand('# Cleared all selectable maps and mapcycle');
}

function clearCycle() {
  cycle = [];
  saveCycle();
  renderCycle();
  addCommand('# Cleared tonight map cycle');
}

function getMapCommand(mapName) {
  const map = maps.find(item => item.name === mapName);
  if (!map) return `changelevel ${mapName}`;
  return map.type === 'workshop'
    ? `host_workshop_map ${map.value}`
    : `changelevel ${map.value}`;
}

async function loadMap(map) {
  const matched = maps.find(item => item.name === map);
  let mapId = map;

  if (matched) {
    if (matched.type === 'workshop') {
      mapId = matched.value.startsWith('workshop:')
        ? matched.value
        : `workshop:${matched.value}`;
    } else {
      mapId = matched.value || matched.name;
    }
  }

  const success = await changeServerMap(mapId);
  if (!success) {
    return;
  }

  const currentMapEl = document.getElementById('currentMap');
  if (currentMapEl) {
    currentMapEl.textContent = map;
  }
}

async function loadNextMap() {
  if (!cycle.length) {
    addCommand('# No maps in tonight cycle');
    return;
  }

  await loadMap(cycle[0]);
}

function generateCycleCommands() {
  if (!cycle.length) {
    addCommand('# No maps selected for cycle');
    return;
  }

  addCommand('# Tonight map cycle');
  cycle.forEach((map, index) => addCommand(`# ${index + 1}. ${getMapCommand(map)}`));
}

async function announceCycle() {
  if (!cycle.length) {
    addCommand('# No maps selected for tonight\'s cycle');
    return;
  }

  const lines = [
    '>>>>> TONIGHT\'S MAP CYCLE <<<<<',
    ...cycle.map((map, index) => `${index + 1}. ${map}`)
  ];

  for (const line of lines) {
    const success = await sendServerMessage(line);
    if (!success) {
      return;
    }
  }

  setServerStatusMessage('Cycle announcement sent.', 'success');
}

function extractWorkshopId(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/(?:id=)?(\d{8,})/);
  return match ? match[1] : trimmed;
}

function buildMapCommand(type, value) {
  if (!value.trim()) return '# Command preview';
  if (type === 'workshop') return `host_workshop_map ${extractWorkshopId(value)}`;
  return `changelevel ${value.trim()}`;
}

function updateNewMapPreview() {
  const type = document.getElementById('mapType').value;
  const value = document.getElementById('newMapValue').value;
  document.getElementById('newMapCommand').textContent = buildMapCommand(type, value);
}

function addMapToLibrary() {
  const type = document.getElementById('mapType').value;
  const nameInput = document.getElementById('newMapName');
  const valueInput = document.getElementById('newMapValue');
  const name = nameInput.value.trim();
  const rawValue = valueInput.value.trim();
  const value = type === 'workshop' ? extractWorkshopId(rawValue) : rawValue;

  if (!name || !value) {
    addCommand('# Missing map name or value');
    return;
  }

  if (maps.some(map => map.name === name)) {
    addCommand(`# Map already exists: ${name}`);
    return;
  }

  maps.push({ name, type, value });
  saveMaps();
  nameInput.value = '';
  valueInput.value = '';
  updateNewMapPreview();
  renderMaps();
  addCommand(`# Added map to library: ${name}`);
}

function toggleBalanceUI() {
  const wrapper = document.getElementById('balanceWrapper');
  const isVisible = wrapper.classList.contains('visible');

  wrapper.classList.toggle('visible');
  if (!isVisible) {
    setTimeout(() => {
      const el = document.getElementById('ctPlayers');
      if (el) el.focus();
    }, 50);
  }
}

function getCTPlayers() {
  const input = document.getElementById('ctPlayers');
  return input ? Number(input.value) : NaN;
}

function getTPlayers() {
  const input = document.getElementById('tPlayers');
  return input ? Number(input.value) : NaN;
}

function showBalanceError(message) {
  const el = document.getElementById('balanceMessage');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('visible', Boolean(message));
}

function validatePlayers(value) {
  if (Number.isNaN(value)) return 'Must be a number between 0 and 10.';
  if (!Number.isInteger(value)) return 'Must be a whole number.';
  if (value < 0 || value > 10) return 'Value must be between 0 and 10.';
  return '';
}

function balanceBots() {
  const ct = getCTPlayers();
  const t = getTPlayers();

  const v1 = validatePlayers(ct);
  const v2 = validatePlayers(t);

  if (v1) {
    showBalanceError(`CT: ${v1}`);
    return;
  }

  if (v2) {
    showBalanceError(`T: ${v2}`);
    return;
  }

  showBalanceError('');

  // Always start with bot_kick per requirement
  addCommand('bot_kick');

  if (ct === t) {
    addCommand("say >>>>> TEAMS ALREADY BALANCED <<<<<");
    return;
  }

  const diff = Math.abs(ct - t);
  const target = ct < t ? 'bot_add_ct' : 'bot_add_t';

  for (let i = 0; i < diff; i++) {
    addCommand(target);
  }
}

function addCTBot() {
  addCommand('bot_add_ct');
}

function addTBot() {
  addCommand('bot_add_t');
}

function kickBots() {
  addCommand('bot_kick');
}

function updatePauseButton() {
  const button = document.getElementById('pauseToggleBtn');
  if (!button) return;

  const label = matchPaused ? 'Resume Match' : 'Pause Match';
  const commandHint = matchPaused ? 'mp_unpause_match' : 'mp_pause_match';

  button.classList.toggle('paused', matchPaused);
  button.innerHTML = `${label}<small>${commandHint}</small>`;
}

function togglePauseMatch() {
  const command = matchPaused ? 'mp_unpause_match' : 'mp_pause_match';
  addCommand(command);
  matchPaused = !matchPaused;
  updatePauseButton();
}

async function requestCommandPreview(command) {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'preview',
      payload: { command }
    })
  });

  if (!response.ok) {
    throw new Error('Could not preview command');
  }

  const data = await response.json();
  return data.preview || command;
}

function addCommand(command) {
  const timestamp = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const lineIndex = consoleLines.push(`[${timestamp}] ${command}`) - 1;
  consoleBox.textContent = consoleLines.join('\n');
  consoleBox.scrollTop = consoleBox.scrollHeight;

  if (command.trim().startsWith('#')) return;

  requestCommandPreview(command)
    .then(preview => {
      consoleLines[lineIndex] = `[${timestamp}] ${preview}`;
      consoleBox.textContent = consoleLines.join('\n');
      consoleBox.scrollTop = consoleBox.scrollHeight;
    })
    .catch(() => {
      consoleLines[lineIndex] = `[${timestamp}] ${command}`;
      consoleBox.textContent = consoleLines.join('\n');
    });
}

function clearConsole() {
  consoleLines = [];
  consoleBox.textContent = '# Commands will appear here...';
}

async function copyConsole() {
  const text = consoleLines.join('\n');
  if (!text) return;
  await navigator.clipboard.writeText(text);
  addCommand('# Copied commands to clipboard');
}

mapSearch.addEventListener('input', renderMaps);

if (inventoryList) {
  inventoryList.addEventListener('click', event => {
    const button = event.target.closest('button[data-action="add-inventory"]');
    if (!button) return;
    const mapName = button.dataset.map;
    addInventoryMap(mapName);
  });
}

const clearMapsBtn = document.getElementById('clearMapsBtn');
if (clearMapsBtn) {
  clearMapsBtn.addEventListener('click', clearMaps);
}

if (refreshAvailableMapsBtn) {
  refreshAvailableMapsBtn.addEventListener('click', refreshAvailableMaps);
}

if (clearAvailableMapsBtn) {
  clearAvailableMapsBtn.addEventListener('click', clearAvailableMaps);
}

if (refreshServerStatusBtn) {
  refreshServerStatusBtn.addEventListener('click', refreshServerStatus);
}

if (csApiMapSelect) {
  csApiMapSelect.addEventListener('change', syncSelectedMapToInput);
}

if (csApiChangeMapBtn) {
  csApiChangeMapBtn.addEventListener('click', changeServerMap);
}

if (csApiRestartMatchBtn) {
  csApiRestartMatchBtn.addEventListener('click', restartMatchApi);
}

if (csApiSendMessageBtn) {
  csApiSendMessageBtn.addEventListener('click', sendServerMessage);
}

if (csApiGetMapcycleBtn) {
  csApiGetMapcycleBtn.addEventListener('click', getCurrentMapcycle);
}

if (csApiUpdateMapcycleBtn) {
  csApiUpdateMapcycleBtn.addEventListener('click', updateMapcycle);
}

if (csApiWarmupBtn) {
  csApiWarmupBtn.addEventListener('click', () => execConfig('wu.cfg', 'wu'));
}

if (csApiOrdinaryBtn) {
  csApiOrdinaryBtn.addEventListener('click', () => execConfig('owu.cfg', 'owu'));
}

updatePauseButton();

function toggleAnnouncementInput() {
  const wrapper = document.getElementById('announcementWrapper');
  const input = document.getElementById('announcementInput');
  const isVisible = wrapper.classList.contains('visible');

  wrapper.classList.toggle('visible');

  if (!isVisible) {
    setTimeout(() => input.focus(), 50);
  } else {
    input.value = '';
  }
}

async function sendAnnouncement() {
  const input = document.getElementById('announcementInput');
  const message = input.value.trim();

  if (!message) {
    setServerStatusMessage('Announcement message cannot be empty.', 'error');
    return;
  }

  const success = await sendServerMessage(message);
  if (!success) {
    return;
  }

  input.value = '';
  const wrapper = document.getElementById('announcementWrapper');
  wrapper.classList.remove('visible');
}

document.getElementById('announcementInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendAnnouncement();
  }
});

function getSuddenDeathStartMoney() {
  const input = document.getElementById('suddenDeathStartMoney');
  return input ? Number(input.value) : NaN;
}

function showSuddenDeathError(message) {
  const messageEl = document.getElementById('suddenDeathMessage');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.classList.toggle('visible', Boolean(message));
}

function validateStartMoney(value) {
  if (Number.isNaN(value)) {
    return 'Start money must be a number between 800 and 16000.';
  }

  if (!Number.isInteger(value)) {
    return 'Start money must be a whole number.';
  }

  if (value < 800 || value > 16000) {
    return 'Start money must be between 800 and 16000.';
  }

  return '';
}

function initiateSuddenDeath() {
  const startMoney = getSuddenDeathStartMoney();
  const validationMessage = validateStartMoney(startMoney);

  if (validationMessage) {
    showSuddenDeathError(validationMessage);
    return;
  }

  showSuddenDeathError('');

  if (!confirm('Start Sudden Death mode?')) {
    return;
  }

  executeSuddenDeathSequence(startMoney);
}

function executeSuddenDeathSequence(startMoney) {
  const commands = [
    `mp_startmoney ${startMoney}`,
    'mp_free_armor 2',
    'mp_maxrounds 1',
    'mp_freezetime 1',
    'mp_restartgame 1',
    'say >>>>>>  SUDDEN DEATH  <<<<<<'
  ];

  commands.forEach(command => addCommand(command));
}

renderMaps();
renderInventory();
renderCycle();
