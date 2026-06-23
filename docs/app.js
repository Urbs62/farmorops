const STORAGE_KEYS = {
  compactMode: 'farmorops.compactMode',
  diagnosticsCollapsed: 'farmorops.diagnosticsCollapsed',
  availableCollapsed: 'farmorops.availableCollapsed',
  selectCollapsed: 'farmorops.selectCollapsed',
  libraryCollapsed: 'farmorops.libraryCollapsed',
  availableFilter: 'farmorops.availableFilter'
};

const LEGACY_MAP_STORAGE_KEYS = {
  selectableMaps: 'farmorops_selectable_maps_v1',
  inventory: 'farmorops_inventory_maps_v1',
  cycle: 'farmorops.mapCycle',
  oldSelectableMaps: 'farmorops.mapLibrary'
};

const ANNOUNCEMENT_SEPARATOR = '====================';
const MATCH_PAUSE_ANNOUNCEMENTS = Object.freeze({
  paused: [
    '================================',
    'MATCH PAUSED',
    'TIME FOR A COMMERCIAL BREAK',
    '================================'
  ].join('\n'),
  resumed: [
    '================================',
    'MATCH RESUMED',
    'GOOD LUCK HAVE FUN',
    '================================'
  ].join('\n')
});
const SERVER_STATUS_REFRESH_INITIAL_DELAY_MS = 1500;
const SERVER_STATUS_REFRESH_RETRY_DELAY_MS = 2000;
const SERVER_STATUS_REFRESH_MAX_RETRIES = 2;

let maps = [];
let inventoryMaps = [];
let cycle = [];
let cycleProgress = { playedMaps: [], currentMap: '' };
let draggedCycleIndex = null;
let cycleDropIndex = null;
let lastServerStatus = null;
let availableFilter = readStorage(STORAGE_KEYS.availableFilter, 'all');
if (!['all', 'favorites', 'standard', 'workshop'].includes(availableFilter)) {
  availableFilter = 'all';
}
let consoleLines = [];
let matchPaused = false;

const mapList = document.getElementById('mapList');
const inventoryList = document.getElementById('inventoryList');
const availableFilterButtons = document.getElementById('availableFilterButtons');
const cycleList = document.getElementById('cycleList');
const consoleBox = document.getElementById('console');
const mapSearch = document.getElementById('mapSearch');
const refreshAvailableMapsBtn = document.getElementById('refreshAvailableMapsBtn');
const clearAvailableMapsBtn = document.getElementById('clearAvailableMapsBtn');
const importStatusEl = document.getElementById('importStatus');
const headerServerName = document.getElementById('headerServerName');
const headerGameName = document.getElementById('headerGameName');
const headerServerStatus = document.getElementById('headerServerStatus');
const headerCurrentMap = document.getElementById('headerCurrentMap');
const headerPlayerCount = document.getElementById('headerPlayerCount');
const refreshServerStatusBtn = document.getElementById('refreshServerStatusBtn');
const csApiCurrentMap = document.getElementById('csApiCurrentMap');
const csApiOnlineStatus = document.getElementById('csApiOnlineStatus');
const csApiPlayerCount = document.getElementById('csApiPlayerCount');
const csApiPlayerList = document.getElementById('csApiPlayerList');
const csApiStatusMessage = document.getElementById('csApiStatusMessage');
const csApiModeBadge = document.getElementById('csApiModeBadge');
const csApiModeWarning = document.getElementById('csApiModeWarning');
const csApiResponseLog = document.getElementById('csApiResponseLog');
const playerStatusDiagnostics = document.getElementById('playerStatusDiagnostics');
const csApiMapcycleWarning = document.getElementById('csApiMapcycleWarning');
const csApiMapSelect = document.getElementById('csApiMapSelect');
const csApiChangeMapInput = document.getElementById('csApiChangeMapInput');
const csApiChangeMapBtn = document.getElementById('csApiChangeMapBtn');
const csApiGetMapcycleBtn = document.getElementById('csApiGetMapcycleBtn');
const csApiUpdateMapcycleBtn = document.getElementById('csApiUpdateMapcycleBtn');
const csApiWarmupBtn = document.getElementById('csApiWarmupBtn');
const csApiOrdinaryBtn = document.getElementById('csApiOrdinaryBtn');
const csApiRestartMatchBtn = document.getElementById('csApiRestartMatchBtn') || document.getElementById('restartMatchBtn');
const pauseToggleBtn = document.getElementById('pauseToggleBtn');
const csApiMessageInput = document.getElementById('csApiMessageInput');
const csApiSendMessageBtn = document.getElementById('csApiSendMessageBtn');
const compactModeToggle = document.getElementById('compactModeToggle');
const diagnosticsToggle = document.getElementById('diagnosticsToggle');
const diagnosticsContent = document.getElementById('diagnosticsContent');
const availableToggle = document.getElementById('availableToggle') || document.getElementById('availableMapsToggle');
const availableContent = document.getElementById('availableContent') || document.getElementById('availableMapsContent');
const selectToggle = document.getElementById('selectToggle');
const selectContent = document.getElementById('selectContent');
const libraryToggle = document.getElementById('libraryToggle');
const libraryContent = document.getElementById('libraryContent');

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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function getInlineStringArg(value) {
  return escapeAttribute(JSON.stringify(value));
}

function formatAnnouncementMessage(message) {
  return [ANNOUNCEMENT_SEPARATOR, message, ANNOUNCEMENT_SEPARATOR];
}

function loadCompactMode() {
  return readStorage(STORAGE_KEYS.compactMode, false) === true;
}

function applyCompactMode(enabled) {
  document.body.classList.toggle('compact-mode', enabled);
  if (compactModeToggle) {
    compactModeToggle.checked = enabled;
  }
}

function setCompactMode(enabled) {
  applyCompactMode(enabled);
  writeStorage(STORAGE_KEYS.compactMode, enabled);
}

function loadDiagnosticsCollapsed() {
  const saved = readStorage(STORAGE_KEYS.diagnosticsCollapsed, null);
  return saved === true ? true : saved === false ? false : null;
}

function applyDiagnosticsCollapsed(collapsed) {
  if (diagnosticsContent) {
    diagnosticsContent.classList.toggle('collapsed', collapsed);
  }
  if (diagnosticsToggle) {
    diagnosticsToggle.checked = collapsed;
  }
}

function setDiagnosticsCollapsed(collapsed) {
  applyDiagnosticsCollapsed(collapsed);
  writeStorage(STORAGE_KEYS.diagnosticsCollapsed, collapsed);
}

function initializeDiagnosticsState() {
  const saved = loadDiagnosticsCollapsed();
  if (saved !== null) {
    applyDiagnosticsCollapsed(saved);
    return;
  }

  const compactModeActive = loadCompactMode();
  applyDiagnosticsCollapsed(compactModeActive);
}

function loadAvailableCollapsed() {
  const saved = readStorage(STORAGE_KEYS.availableCollapsed, null);
  return saved === true ? true : saved === false ? false : null;
}

function applyAvailableCollapsed(collapsed) {
  if (!availableContent) return;
  availableContent.classList.toggle('collapsed', collapsed);
  if (availableToggle) availableToggle.checked = collapsed;
}

function setAvailableCollapsed(collapsed) {
  applyAvailableCollapsed(collapsed);
  writeStorage(STORAGE_KEYS.availableCollapsed, collapsed);
}

function initializeAvailableState() {
  const saved = loadAvailableCollapsed();
  if (saved !== null) {
    applyAvailableCollapsed(saved);
    return;
  }

  const compactModeActive = loadCompactMode();
  applyAvailableCollapsed(Boolean(compactModeActive));
}

function loadSelectCollapsed() {
  const saved = readStorage(STORAGE_KEYS.selectCollapsed, null);
  return saved === true ? true : saved === false ? false : null;
}

function applySelectCollapsed(collapsed) {
  if (!selectContent) return;
  selectContent.classList.toggle('collapsed', collapsed);
  if (selectToggle) selectToggle.checked = collapsed;
}

function setSelectCollapsed(collapsed) {
  applySelectCollapsed(collapsed);
  writeStorage(STORAGE_KEYS.selectCollapsed, collapsed);
}

function initializeSelectState() {
  const saved = loadSelectCollapsed();
  if (saved !== null) {
    applySelectCollapsed(saved);
    return;
  }

  const compactModeActive = loadCompactMode();
  applySelectCollapsed(Boolean(compactModeActive));
}

function loadLibraryCollapsed() {
  const saved = readStorage(STORAGE_KEYS.libraryCollapsed, null);
  return saved === true ? true : saved === false ? false : null;
}

function applyLibraryCollapsed(collapsed) {
  if (!libraryContent) return;
  libraryContent.classList.toggle('collapsed', collapsed);
  if (libraryToggle) libraryToggle.checked = collapsed;
}

function setLibraryCollapsed(collapsed) {
  applyLibraryCollapsed(collapsed);
  writeStorage(STORAGE_KEYS.libraryCollapsed, collapsed);
}

function initializeLibraryState() {
  const saved = loadLibraryCollapsed();
  if (saved !== null) {
    applyLibraryCollapsed(saved);
    return;
  }

  const compactModeActive = loadCompactMode();
  applyLibraryCollapsed(Boolean(compactModeActive));
}

function isValidMap(map) {
  return map
    && typeof map.name === 'string'
    && typeof map.type === 'string'
    && typeof map.value === 'string';
}

function normalizeStoredMap(map) {
  return {
    ...map,
    favorite: map.favorite === true
  };
}

function normalizeSharedMapState(state) {
  const source = state && typeof state === 'object' && !Array.isArray(state)
    ? state
    : {};
  const tonightMapCycle = Array.isArray(source.tonightMapCycle) && source.tonightMapCycle.every(map => typeof map === 'string')
    ? source.tonightMapCycle
    : [];
  const progress = source.tonightMapProgress && typeof source.tonightMapProgress === 'object' && !Array.isArray(source.tonightMapProgress)
    ? source.tonightMapProgress
    : {};
  const playedMaps = Array.isArray(progress.playedMaps)
    ? progress.playedMaps.filter(map => typeof map === 'string' && tonightMapCycle.includes(map))
    : [];
  const currentMap = typeof progress.currentMap === 'string' && tonightMapCycle.includes(progress.currentMap)
    ? progress.currentMap
    : '';

  return {
    availableMaps: Array.isArray(source.availableMaps) && source.availableMaps.every(isValidMap)
      ? source.availableMaps.map(normalizeStoredMap)
      : [],
    selectableMaps: Array.isArray(source.selectableMaps) && source.selectableMaps.every(isValidMap)
      ? source.selectableMaps.map(normalizeStoredMap)
      : [],
    tonightMapCycle,
    tonightMapProgress: {
      playedMaps: [...new Set(playedMaps)],
      currentMap
    }
  };
}

function getCurrentSharedMapState() {
  return {
    availableMaps: inventoryMaps,
    selectableMaps: maps,
    tonightMapCycle: cycle,
    tonightMapProgress: cycleProgress
  };
}

function applySharedMapState(state) {
  const nextState = normalizeSharedMapState(state);
  inventoryMaps = nextState.availableMaps;
  maps = nextState.selectableMaps;
  cycle = nextState.tonightMapCycle;
  cycleProgress = nextState.tonightMapProgress;
}

function hasSharedMapState(state) {
  return Boolean(
    state.availableMaps.length
    || state.selectableMaps.length
    || state.tonightMapCycle.length
  );
}

function getLegacySharedMapState() {
  let legacySelectableMaps = readStorage(LEGACY_MAP_STORAGE_KEYS.selectableMaps, null);
  if (legacySelectableMaps === null) {
    legacySelectableMaps = readStorage(LEGACY_MAP_STORAGE_KEYS.oldSelectableMaps, null);
  }

  return normalizeSharedMapState({
    availableMaps: readStorage(LEGACY_MAP_STORAGE_KEYS.inventory, []),
    selectableMaps: legacySelectableMaps || [],
    tonightMapCycle: readStorage(LEGACY_MAP_STORAGE_KEYS.cycle, [])
  });
}

function clearLegacySharedMapState() {
  try {
    Object.values(LEGACY_MAP_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  } catch (error) {
    addCommand('# Could not clear legacy local map state');
  }
}

async function loadSharedMapState() {
  const response = await fetch('/api/state/maps', { credentials: 'include' });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = body?.message || body?.error || response.statusText;
    throw new Error(`Failed to load shared map state: ${response.status} ${errorMessage}`);
  }

  let state = normalizeSharedMapState(body);
  const legacyState = getLegacySharedMapState();

  if (!hasSharedMapState(state) && hasSharedMapState(legacyState)) {
    await saveSharedMapState(legacyState);
    clearLegacySharedMapState();
    state = legacyState;
    setImportStatus('Migrated local map state to shared backend storage.', 'success');
  }

  applySharedMapState(state);
}

async function saveSharedMapState(state = getCurrentSharedMapState()) {
  const response = await fetch('/api/state/maps', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeSharedMapState(state))
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = body?.message || body?.error || response.statusText;
    throw new Error(`Failed to save shared map state: ${response.status} ${errorMessage}`);
  }

  applySharedMapState(body);
}

function showSharedMapStateError(error, action = 'save') {
  const message = error && error.message ? error.message : 'Unknown error';
  setImportStatus(`Shared map state ${action} failed: ${message}`, 'error');
  addCommand(`# Shared map state ${action} failed: ${message}`);
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

function appendFormattedAnnouncementLog(lines) {
  if (!csApiResponseLog) return;
  const timestamp = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  csApiResponseLog.textContent = `[${timestamp}] Formatted server message sent:\n${lines.join('\n')}\n\n${csApiResponseLog.textContent || ''}`;
}

function renderAvailableMapOptions() {
  if (!csApiMapSelect) return;

  const options = [...inventoryMaps].sort(compareMapsByFavoriteThenName).map(map => {
    const title = map.type === 'workshop'
      ? `${map.name} (WORKSHOP)`
      : `${map.name} (BUILTIN)`;
    const mapValue = getChangeMapValue(map);
    const disabled = map.unavailable || !mapValue ? 'disabled' : '';
    return `
      <option value="${escapeAttribute(mapValue)}" ${disabled}>${escapeHtml(title)}</option>
    `;
  }).join('');

  csApiMapSelect.innerHTML = `<option value="">Choose an available map</option>${options}`;
}

function syncSelectedMapToInput() {
  if (!csApiMapSelect || !csApiChangeMapBtn) return;
  const selected = csApiMapSelect.value;
  if (selected && csApiChangeMapInput) {
    csApiChangeMapInput.value = selected;
  }
}

function renderHeaderServerStatus(status) {
  const serverName = status?.serverName || status?.name || 'Farmor';
  const gameName = status?.game || status?.gameName || 'CS2';
  const isOnline = Boolean(status?.online);
  const playerCount = typeof status?.playerCount === 'number' ? status.playerCount : 0;
  const maxPlayers = typeof status?.maxPlayers === 'number' ? status.maxPlayers : 0;

  if (headerServerName) headerServerName.textContent = serverName;
  if (headerGameName) headerGameName.textContent = gameName;
  if (headerServerStatus) {
    headerServerStatus.textContent = isOnline ? 'Online' : 'Offline';
    headerServerStatus.classList.toggle('offline', !isOnline);
  }
  if (headerCurrentMap) headerCurrentMap.textContent = status?.currentMap ? `Map: ${status.currentMap}` : '';
  if (headerPlayerCount) {
    headerPlayerCount.textContent = maxPlayers ? `Players: ${playerCount} / ${maxPlayers}` : `Players: ${playerCount}`;
  }
}

function getStatusPlayers(status) {
  return Array.isArray(status?.players) ? status.players : [];
}

function getPlayerCountLabel(status, players) {
  const playerCount = typeof status?.playerCount === 'number' ? status.playerCount : 0;
  const maxPlayers = typeof status?.maxPlayers === 'number' ? status.maxPlayers : 0;
  const listedCount = players.length;
  const baseLabel = maxPlayers ? `${playerCount} / ${maxPlayers}` : `${playerCount} total`;

  if (playerCount !== listedCount) {
    return `${baseLabel} (${listedCount} player details available)`;
  }

  return baseLabel;
}

function formatPlayerDuration(player) {
  const seconds = Number(
    player?.durationSeconds
    ?? player?.connectedSeconds
    ?? player?.timeSeconds
    ?? player?.playTimeSeconds
  );

  if (!Number.isFinite(seconds) || seconds <= 0) return '';

  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function formatPlayerTeam(player) {
  const team = String(player?.teamName || player?.team || '').trim();
  if (!team || ['null', 'undefined', 'unknown', 'none'].includes(team.toLowerCase())) return '';

  const normalized = team.toLowerCase();
  if (['ct', 'counter-terrorist', 'counterterrorist', 'counter terrorist'].includes(normalized)) return 'CT';
  if (['t', 'terrorist'].includes(normalized)) return 'T';
  if (['spectator', 'spectators', 'spec'].includes(normalized)) return 'Spectator';

  return team;
}

function getPlayerDisplayName(player, index) {
  const name = String(player?.nickname || player?.name || player?.playerName || '').trim();
  if (name && !['null', 'undefined'].includes(name.toLowerCase())) return name;
  return 'Player details unavailable';
}

function renderPlayerItem(player, index) {
  const name = getPlayerDisplayName(player, index);
  const team = formatPlayerTeam(player);
  const duration = formatPlayerDuration(player);
  const teamText = team ? ` (${team})` : '';
  const durationText = duration ? ` - ${duration}` : '';

  return `
    <div class="player-item">
      <strong>${escapeHtml(name)}${escapeHtml(teamText)}${escapeHtml(durationText)}</strong>
    </div>
  `;
}

function renderPlayerDiagnostics(status, players) {
  if (!playerStatusDiagnostics) return;
  const playerCount = typeof status?.playerCount === 'number' ? status.playerCount : 0;
  playerStatusDiagnostics.textContent = `Raw player count: ${playerCount}. Listed player count: ${players.length}.`;
}

function renderServerStatus(status) {
  lastServerStatus = status || null;
  const players = getStatusPlayers(status);
  renderHeaderServerStatus(status);
  if (csApiCurrentMap) {
    csApiCurrentMap.textContent = status?.currentMap || '—';
  }

  if (csApiOnlineStatus) {
    csApiOnlineStatus.textContent = status?.online ? 'Online' : 'Offline';
  }

  if (csApiPlayerCount) {
    csApiPlayerCount.textContent = getPlayerCountLabel(status, players);
  }

  if (csApiPlayerList) {
    if (!players.length) {
      csApiPlayerList.innerHTML = '<div class="player-item">No players connected.</div>';
      renderPlayerDiagnostics(status, players);
      return;
    }

    csApiPlayerList.innerHTML = players.map(renderPlayerItem).join('');
  }

  renderPlayerDiagnostics(status, players);
}

function getMapKey(map) {
  return map.id || map.value || map.name || '';
}

function getMapIdentity(map) {
  return String(map?.id || map?.name || map?.value || '');
}

function areSameMapIdentity(left, right) {
  if (!left || !right) return false;
  if (left.id || right.id) {
    return Boolean(left.id && right.id && left.id === right.id);
  }

  if (left.value && right.value) {
    return left.type === right.type && left.value === right.value;
  }

  return left.type === right.type && left.name === right.name;
}

function compareMapsByFavoriteThenName(left, right) {
  if (Boolean(left.favorite) !== Boolean(right.favorite)) {
    return left.favorite ? -1 : 1;
  }

  return String(left.name || '').localeCompare(String(right.name || ''), 'sv', { sensitivity: 'base' });
}

function getFavoriteForMap(map) {
  const inventoryMatch = inventoryMaps.find(item => areSameMapIdentity(item, map));
  if (inventoryMatch) return Boolean(inventoryMatch.favorite);

  const selectableMatch = maps.find(item => areSameMapIdentity(item, map));
  return Boolean(selectableMatch?.favorite);
}

function findMapByCycleName(mapName) {
  return maps.find(map => map.name === mapName)
    || inventoryMaps.find(map => map.name === mapName)
    || { name: mapName, type: 'standard', value: mapName };
}

function renderFavoriteButton(map) {
  const favorite = getFavoriteForMap(map);
  const label = favorite ? `Remove ${map.name} from favorites` : `Mark ${map.name} as favorite`;

  return `
    <button
      type="button"
      class="favorite-button${favorite ? ' active' : ''}"
      data-action="toggle-favorite"
      data-map-key="${escapeAttribute(getMapIdentity(map))}"
      aria-label="${escapeAttribute(label)}"
      aria-pressed="${favorite}"
      title="${escapeAttribute(label)}"
    >${favorite ? '★' : '☆'}</button>
  `;
}

async function toggleMapFavorite(mapKey) {
  const allMaps = [...inventoryMaps, ...maps];
  const target = allMaps.find(map => getMapIdentity(map) === mapKey);
  if (!target) return;

  const nextFavorite = !getFavoriteForMap(target);
  const applyFavorite = map => areSameMapIdentity(map, target)
    ? { ...map, favorite: nextFavorite }
    : map;
  const previousInventoryMaps = inventoryMaps;
  const previousMaps = maps;

  inventoryMaps = inventoryMaps.map(applyFavorite);
  maps = maps.map(applyFavorite);
  renderInventory();
  renderMaps();
  renderCycle();

  try {
    await saveSharedMapState();
    renderInventory();
    renderMaps();
    renderCycle();
    addCommand(`# ${nextFavorite ? 'Favorited' : 'Unfavorited'} map: ${target.name}`);
  } catch (err) {
    inventoryMaps = previousInventoryMaps;
    maps = previousMaps;
    renderInventory();
    renderMaps();
    renderCycle();
    showSharedMapStateError(err);
  }
}

function getChangeMapValue(map) {
  if (!map || typeof map !== 'object') return '';

  if (map.type === 'workshop' || map.origin === 'WORKSHOP') {
    const workshopValue = map.id && String(map.id).startsWith('workshop:')
      ? map.id
      : map.value || map.workshopId || map.name || '';
    return String(workshopValue).startsWith('workshop:')
      ? String(workshopValue)
      : `workshop:${workshopValue}`;
  }

  return map.value || map.name || map.id || '';
}

function normalizeMapToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^workshop:/, '');
}

function getCycleMapCandidates(cycleMap) {
  const matched = maps.find(map => map.name === cycleMap);
  const candidates = [cycleMap];

  if (matched) {
    candidates.push(matched.name, matched.value, matched.id, getChangeMapValue(matched));
  }

  return candidates
    .filter(Boolean)
    .map(normalizeMapToken);
}

function findCycleMapByServerValue(value) {
  const normalizedValue = normalizeMapToken(value);
  if (!normalizedValue) return '';

  return cycle.find(cycleMap => getCycleMapCandidates(cycleMap).includes(normalizedValue)) || '';
}

function getCleanCycleProgress(progress = cycleProgress) {
  const playedMaps = Array.isArray(progress.playedMaps)
    ? progress.playedMaps.filter(map => cycle.includes(map) && map !== progress.currentMap)
    : [];
  const currentMap = typeof progress.currentMap === 'string' && cycle.includes(progress.currentMap)
    ? progress.currentMap
    : '';

  return {
    playedMaps: [...new Set(playedMaps)],
    currentMap
  };
}

async function saveCycleProgress(nextProgress) {
  cycleProgress = getCleanCycleProgress(nextProgress);
  renderCycle();
  await saveSharedMapState();
  renderCycle();
}

async function updateCycleProgressForLoadedMap(mapValue) {
  const cycleMap = findCycleMapByServerValue(mapValue);
  if (!cycleMap) return;

  const cycleIndex = cycle.indexOf(cycleMap);
  const playedMaps = new Set(cycleProgress.playedMaps || []);
  cycle.slice(0, cycleIndex).forEach(map => playedMaps.add(map));
  playedMaps.delete(cycleMap);

  await saveCycleProgress({
    playedMaps: [...playedMaps],
    currentMap: cycleMap
  });
}

async function syncCycleProgressFromServerStatus(status) {
  const cycleMap = findCycleMapByServerValue(status?.currentMap);
  if (!cycleMap || cycleProgress.currentMap === cycleMap) return;
  const currentIndex = cycle.indexOf(cycleProgress.currentMap);
  const statusIndex = cycle.indexOf(cycleMap);
  if (currentIndex >= 0 && statusIndex >= 0 && statusIndex < currentIndex) return;

  await saveCycleProgress({
    playedMaps: cycleProgress.playedMaps || [],
    currentMap: cycleMap
  });
}

function getAvailableMapSourceType(map) {
  if (map?.origin === 'WORKSHOP' || map?.source === 'WORKSHOP' || map?.type === 'workshop') {
    return 'workshop';
  }

  return 'standard';
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

  maps = maps.map((map) => {
    if (map.origin && !serverKeys.has(getMapKey(map))) {
      return { ...map, unavailable: true };
    }
    return { ...map, unavailable: false };
  });
}

async function refreshServerStatus() {
  if (refreshServerStatusBtn) {
    refreshServerStatusBtn.disabled = true;
  }
  setServerStatusMessage('Loading server status...', 'info');

  try {
    const response = await fetch('/api/cs/status', { credentials: 'include' });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Get server status', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Failed to load server status: ${response.status} ${errorMessage}`, 'error');
      return null;
    }

    if (body?.commandMode) {
      if (body.commandMode === 'local-preview') {
        setCsApiModeBadge('Preview mode', 'preview');
        setCsApiModeWarning('Preview mode is active. Server actions are not being sent to the live server.');
      } else {
        setCsApiModeBadge('Live mode', 'live');
        setCsApiModeWarning('');
      }
    } else {
      setCsApiModeBadge('Unknown mode', 'warning');
      setCsApiModeWarning('');
    }

    renderServerStatus(body);
    try {
      await syncCycleProgressFromServerStatus(body);
    } catch (err) {
      showSharedMapStateError(err);
    }
    setServerStatusMessage('Server status updated.', 'success');
    return body;
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog('Get server status', null, { error: message });
    setServerStatusMessage(`Status error: ${message}`, 'error');
    return null;
  } finally {
    if (refreshServerStatusBtn) {
      refreshServerStatusBtn.disabled = false;
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeStatusMapName(value) {
  return String(value || '').trim().toLowerCase();
}

function statusStillShowsPreviousMap(status, previousMap) {
  if (!previousMap || !status?.currentMap) return false;
  return normalizeStatusMapName(status.currentMap) === normalizeStatusMapName(previousMap);
}

async function refreshServerStatusAfterAction({
  logMessage,
  updatedMessage = 'Server status updated',
  previousMap = ''
} = {}) {
  if (logMessage) {
    addCommand(`# ${logMessage}`);
  }

  await delay(SERVER_STATUS_REFRESH_INITIAL_DELAY_MS);

  for (let attempt = 0; attempt <= SERVER_STATUS_REFRESH_MAX_RETRIES; attempt += 1) {
    const status = await refreshServerStatus();
    const needsRetry = !status || statusStillShowsPreviousMap(status, previousMap);

    if (!needsRetry) {
      addCommand(`# ${updatedMessage}`);
      return status;
    }

    if (attempt < SERVER_STATUS_REFRESH_MAX_RETRIES) {
      await delay(SERVER_STATUS_REFRESH_RETRY_DELAY_MS);
    }
  }

  return null;
}

async function changeServerMap(mapIdOverride) {
  let mapId = typeof mapIdOverride === 'string'
    ? mapIdOverride.trim()
    : '';
  const previousMap = lastServerStatus?.currentMap || '';

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
    appendCsApiResponseLog(`Change map: ${mapId}`, response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Change map failed: ${response.status} ${errorMessage}`, 'error');
      return false;
    }

    if (typeof mapIdOverride !== 'string' && csApiChangeMapInput) {
      csApiChangeMapInput.value = '';
    }

    setServerStatusMessage(`Map change requested: ${mapId}`, 'success');
    matchPaused = false;
    updatePauseButton();
    try {
      await updateCycleProgressForLoadedMap(mapId);
    } catch (err) {
      showSharedMapStateError(err);
    }
    await refreshServerStatusAfterAction({
      logMessage: 'Refreshing server status after map change',
      previousMap
    });
    return true;
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog(`Change map: ${mapId}`, null, { error: message });
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
    matchPaused = false;
    updatePauseButton();
    await refreshServerStatusAfterAction({
      logMessage: 'Refreshing server status after restart match'
    });
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

async function sendServerMessage(messageOverride, options = {}) {
  const {
    logLabel = 'Send message',
    updateStatus = true
  } = options;
  const message = (typeof messageOverride === 'string'
    ? messageOverride.trim()
    : csApiMessageInput?.value.trim() || '');

  if (!message) {
    if (updateStatus) {
      setServerStatusMessage('Message text is required.', 'error');
    }
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
    appendCsApiResponseLog(logLabel, response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      if (updateStatus) {
        setServerStatusMessage(`Send message failed: ${response.status} ${errorMessage}`, 'error');
      }
      return false;
    }

    if (typeof messageOverride !== 'string' && csApiMessageInput) {
      csApiMessageInput.value = '';
    }

    if (updateStatus) {
      setServerStatusMessage('Server message sent.', 'success');
    }
    return true;
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog(logLabel, null, { error: message });
    if (updateStatus) {
      setServerStatusMessage(`Send message error: ${message}`, 'error');
    }
    return false;
  } finally {
    if (csApiSendMessageBtn) {
      csApiSendMessageBtn.disabled = false;
    }
  }
}

async function sendFormattedServerMessage(message) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    setServerStatusMessage('Message text is required.', 'error');
    return false;
  }

  const formattedLines = formatAnnouncementMessage(trimmedMessage);
  for (const line of formattedLines) {
    const success = await sendServerMessage(line);
    if (!success) return false;
  }

  appendFormattedAnnouncementLog(formattedLines);
  return true;
}

async function sendPresetAnnouncement(button) {
  const message = button?.dataset.message || '';
  if (button) button.disabled = true;

  try {
    return await sendFormattedServerMessage(message);
  } finally {
    if (button) button.disabled = false;
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
    await refreshServerStatusAfterAction({
      logMessage: `Refreshing server status after exec config ${config}`
    });
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
    await saveSharedMapState();
    renderInventory();
    renderMaps();
    setImportStatus(`Refreshed ${body.length} map(s) from server.`, 'success');
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    setImportStatus(`Refresh error: ${message}`, 'error');
    if (message.includes('shared map state')) {
      addCommand(`# Shared map state save failed: ${message}`);
    }
  } finally {
    refreshAvailableMapsBtn.disabled = false;
  }
}

async function clearAvailableMaps() {
  if (!clearAvailableMapsBtn) return;
  if (!confirm('Remove all maps from Available Maps?')) {
    return;
  }

  inventoryMaps = [];
  try {
    await saveSharedMapState();
    renderInventory();
    setImportStatus('Cleared all Available Maps.', 'success');
  } catch (err) {
    showSharedMapStateError(err);
  }
}

function isSelectableMap(map) {
  return maps.some(item => item.name === map.name);
}

async function addInventoryMap(mapName) {
  const map = inventoryMaps.find(item => item.name === mapName);
  if (!map || isSelectableMap(map)) return;

  maps.push({ ...map, source: 'inventory' });
  try {
    await saveSharedMapState();
    renderMaps();
    renderInventory();
    addCommand(`# Added to selectable maps: ${map.name}`);
  } catch (err) {
    maps = maps.filter(item => item.name !== map.name);
    renderMaps();
    renderInventory();
    showSharedMapStateError(err);
  }
}

async function removeSelectableMap(mapName) {
  const index = maps.findIndex(item => item.name === mapName);
  if (index === -1) return;

  const removedMap = maps.splice(index, 1)[0];

  const removedFromCycle = cycle.includes(mapName);
  const previousCycle = [...cycle];
  if (removedFromCycle) {
    cycle = cycle.filter(item => item !== mapName);
  }

  try {
    await saveSharedMapState();
    renderMaps();
    renderInventory();
    renderCycle();
    addCommand(`# Removed from selectable maps: ${mapName}`);
    if (removedFromCycle) {
      addCommand(`# Removed from tonight cycle: ${mapName}`);
    }
  } catch (err) {
    maps.splice(index, 0, removedMap);
    cycle = previousCycle;
    renderMaps();
    renderInventory();
    renderCycle();
    showSharedMapStateError(err);
  }
}

function getAvailableFilterCounts() {
  return {
    all: inventoryMaps.length,
    favorites: inventoryMaps.filter(map => getFavoriteForMap(map)).length,
    standard: inventoryMaps.filter(map => getAvailableMapSourceType(map) === 'standard').length,
    workshop: inventoryMaps.filter(map => getAvailableMapSourceType(map) === 'workshop').length
  };
}

function getFilteredInventoryMaps() {
  if (availableFilter === 'favorites') {
    return inventoryMaps.filter(map => getFavoriteForMap(map));
  }

  if (availableFilter === 'standard') {
    return inventoryMaps.filter(map => getAvailableMapSourceType(map) === 'standard');
  }

  if (availableFilter === 'workshop') {
    return inventoryMaps.filter(map => getAvailableMapSourceType(map) === 'workshop');
  }

  return inventoryMaps;
}

function renderAvailableFilterButtons() {
  if (!availableFilterButtons) return;

  const counts = getAvailableFilterCounts();
  const buttons = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'favorites', label: 'Favorites', count: counts.favorites },
    { key: 'standard', label: 'Standard', count: counts.standard },
    { key: 'workshop', label: 'Workshop', count: counts.workshop }
  ];

  availableFilterButtons.innerHTML = buttons.map(button => `
    <button
      type="button"
      class="filter-chip${availableFilter === button.key ? ' active' : ''}"
      data-filter="${button.key}"
      aria-pressed="${availableFilter === button.key}"
    >
      ${button.label} <span>(${button.count})</span>
    </button>
  `).join('');
}

function setAvailableFilter(filter) {
  const nextFilter = ['favorites', 'standard', 'workshop'].includes(filter) ? filter : 'all';
  availableFilter = nextFilter;
  writeStorage(STORAGE_KEYS.availableFilter, availableFilter);
  renderAvailableFilterButtons();
  renderInventory();
}

function renderInventory() {
  if (!inventoryList) return;

  const filteredMaps = getFilteredInventoryMaps().sort(compareMapsByFavoriteThenName);

  if (!filteredMaps.length) {
    inventoryList.innerHTML = '<div class="empty">No maps match the selected source filter.</div>';
    renderAvailableFilterButtons();
    renderAvailableMapOptions();
    return;
  }

  inventoryList.innerHTML = filteredMaps.map(map => {
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
            ${renderFavoriteButton(map)}
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

  renderAvailableFilterButtons();
  renderAvailableMapOptions();
}

function renderMaps() {
  const query = mapSearch.value.toLowerCase().trim();
  const filtered = maps
    .filter(map => map.name.toLowerCase().includes(query) || map.value.toLowerCase().includes(query))
    .sort(compareMapsByFavoriteThenName);

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
        <div class="map-row-left">
          <div class="map-title-row">
            ${renderFavoriteButton(map)}
            <span class="map-name">${map.name}</span>
            ${origin}
          </div>
          <div class="map-meta">
            <small>${map.type === 'workshop' ? 'Workshop ID: ' + map.value : 'Standard map'}</small>
            ${unavailableNote}
          </div>
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
    cycleList.innerHTML = '<div class="empty">No maps selected yet. Add maps from the list above.</div>';
    return;
  }

  cycleProgress = getCleanCycleProgress();

  cycleList.innerHTML = cycle.map((map, index) => {
    const mapDetails = findMapByCycleName(map);
    const isCurrent = cycleProgress.currentMap === map;
    const isPlayed = !isCurrent && cycleProgress.playedMaps.includes(map);
    const progressIcon = isCurrent ? '&#9654;' : isPlayed ? '&#10003;' : '';
    const progressLabel = isCurrent ? 'Current map' : isPlayed ? 'Played map' : 'Upcoming map';

    return `
    <div class="cycle-item${isCurrent ? ' cycle-current' : ''}${isPlayed ? ' cycle-played' : ''}" draggable="true" data-cycle-index="${index}">
      <button
        class="drag-handle"
        type="button"
        aria-label="Drag ${escapeHtml(map)}"
        title="Drag to reorder"
      >&#8942;&#8942;</button>
      <span class="nr">${index + 1}</span>
      <span class="cycle-progress-icon" aria-label="${progressLabel}" title="${progressLabel}">${progressIcon}</span>
      ${renderFavoriteButton(mapDetails)}
      <span class="map-name">${escapeHtml(map)}</span>
      <div class="cycle-move-actions" aria-label="Move ${escapeHtml(map)}">
        <button class="secondary icon-button" onclick="moveMapInCycle(${index}, -1)" ${index === 0 ? 'disabled' : ''} aria-label="Move ${escapeHtml(map)} up">&uarr;</button>
        <button class="secondary icon-button" onclick="moveMapInCycle(${index}, 1)" ${index === cycle.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(map)} down">&darr;</button>
      </div>
      <button class="secondary readiness-verified-api" onclick="loadMap(${getInlineStringArg(map)})" title="Verified CS API action">Load</button>
      <button class="danger" onclick="removeMap(${index})">Remove</button>
    </div>
  `;
  }).join('');
}

function clearCycleDropFeedback() {
  cycleList.querySelectorAll('.cycle-drop-before, .cycle-drop-after').forEach(item => {
    item.classList.remove('cycle-drop-before', 'cycle-drop-after');
  });
}

function setCycleDropFeedback(item, position) {
  clearCycleDropFeedback();
  item.classList.add(position === 'after' ? 'cycle-drop-after' : 'cycle-drop-before');
}

function getCycleDropIndex(event, item) {
  const index = Number(item.dataset.cycleIndex);
  const rect = item.getBoundingClientRect();
  const position = event.clientY > rect.top + (rect.height / 2) ? 'after' : 'before';
  return {
    index: position === 'after' ? index + 1 : index,
    position
  };
}

async function reorderCycle(fromIndex, toIndex) {
  if (fromIndex === null || fromIndex < 0 || fromIndex >= cycle.length) return;
  if (toIndex < 0 || toIndex > cycle.length) return;
  if (toIndex === fromIndex || toIndex === fromIndex + 1) return;

  const previousCycle = [...cycle];
  const nextCycle = [...cycle];
  const [movedMap] = nextCycle.splice(fromIndex, 1);
  const insertIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  nextCycle.splice(insertIndex, 0, movedMap);
  cycle = nextCycle;
  renderCycle();

  try {
    await saveSharedMapState();
    renderCycle();
    addCommand(`# Reordered tonight cycle: ${movedMap}`);
  } catch (err) {
    cycle = previousCycle;
    renderCycle();
    showSharedMapStateError(err);
  }
}

async function moveMapInCycle(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= cycle.length) return;
  await reorderCycle(index, direction > 0 ? targetIndex + 1 : targetIndex);
}

async function addMapToCycle(map) {
  if (cycle.includes(map)) return;

  cycle.push(map);
  try {
    await saveSharedMapState();
    renderCycle();
    addCommand(`# Added to tonight cycle: ${map}`);
  } catch (err) {
    cycle = cycle.filter(item => item !== map);
    renderCycle();
    showSharedMapStateError(err);
  }
}

async function removeMap(index) {
  const removed = cycle.splice(index, 1)[0];
  try {
    await saveSharedMapState();
    renderCycle();
    addCommand(`# Removed from tonight cycle: ${removed}`);
  } catch (err) {
    cycle.splice(index, 0, removed);
    renderCycle();
    showSharedMapStateError(err);
  }
}

async function clearMaps() {
  if (!confirm('Remove all maps from the active list and clear the mapcycle?')) {
    return;
  }

  const previousMaps = [...maps];
  const previousCycle = [...cycle];
  maps = [];
  cycle = [];
  try {
    await saveSharedMapState();
    renderMaps();
    renderCycle();
    addCommand('# Cleared all selectable maps and mapcycle');
  } catch (err) {
    maps = previousMaps;
    cycle = previousCycle;
    renderMaps();
    renderCycle();
    showSharedMapStateError(err);
  }
}

async function clearCycle() {
  const previousCycle = [...cycle];
  cycle = [];
  try {
    await saveSharedMapState();
    renderCycle();
    addCommand('# Cleared tonight map cycle');
  } catch (err) {
    cycle = previousCycle;
    renderCycle();
    showSharedMapStateError(err);
  }
}

async function resetCycleProgress() {
  const previousProgress = { ...cycleProgress, playedMaps: [...(cycleProgress.playedMaps || [])] };
  cycleProgress = { playedMaps: [], currentMap: '' };
  renderCycle();

  try {
    await saveSharedMapState();
    renderCycle();
    addCommand('# Reset tonight cycle progress');
  } catch (err) {
    cycleProgress = previousProgress;
    renderCycle();
    showSharedMapStateError(err);
  }
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
  cycle.forEach((map, index) => addCommand(`# ${index + 1}. ${map}`));
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
  const preview = document.getElementById('newMapCommand');
  if (preview) {
    preview.textContent = buildMapCommand(type, value);
  }
}

async function addMapToLibrary() {
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
  try {
    await saveSharedMapState();
    nameInput.value = '';
    valueInput.value = '';
    updateNewMapPreview();
    renderMaps();
    renderInventory();
    addCommand(`# Added map to library: ${name}`);
  } catch (err) {
    maps = maps.filter(map => map.name !== name);
    renderMaps();
    renderInventory();
    showSharedMapStateError(err);
  }
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
  if (!pauseToggleBtn) return;

  const label = matchPaused ? 'Resume Match' : 'Pause Match';

  pauseToggleBtn.classList.toggle('paused', matchPaused);
  pauseToggleBtn.textContent = label;
}

async function togglePauseMatch() {
  if (!pauseToggleBtn) return false;
  pauseToggleBtn.disabled = true;

  try {
    const response = await fetch('/api/cs/toggle-pause', {
      method: 'POST',
      credentials: 'include'
    });
    const body = await response.json().catch(() => null);
    appendCsApiResponseLog('Toggle pause', response, body);

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || response.statusText;
      setServerStatusMessage(`Toggle pause failed: ${response.status} ${errorMessage}`, 'error');
      return false;
    }

    matchPaused = body?.paused === true;
    updatePauseButton();
    setServerStatusMessage(matchPaused ? 'Match pause requested.' : 'Match resume requested.', 'success');

    const announcementAction = matchPaused ? 'Pause announcement' : 'Resume announcement';
    await sendServerMessage(MATCH_PAUSE_ANNOUNCEMENTS[matchPaused ? 'paused' : 'resumed'], {
      logLabel: announcementAction,
      updateStatus: false
    });
    return true;
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error';
    appendCsApiResponseLog('Toggle pause', null, { error: message });
    setServerStatusMessage(`Toggle pause error: ${message}`, 'error');
    return false;
  } finally {
    pauseToggleBtn.disabled = false;
  }
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

function getActivityLabel(command) {
  const trimmed = command.trim();

  if (trimmed.startsWith('#')) {
    return trimmed.replace(/^#\s*/, '');
  }

  const labels = {
    'bot_kick': 'Kick bots',
    'bot_add_ct': 'Add CT bot',
    'bot_add_t': 'Add T bot',
    'mp_pause_match': 'Pause match',
    'mp_unpause_match': 'Resume match',
    'mp_restartgame 1': 'Restart match',
    'mp_free_armor 2': 'Enable sudden death armor',
    'mp_maxrounds 1': 'Set sudden death round limit',
    'mp_freezetime 1': 'Set sudden death freeze time'
  };

  if (labels[trimmed]) {
    return labels[trimmed];
  }

  if (trimmed.startsWith('say ')) {
    return 'Send announcement';
  }

  if (trimmed.startsWith('mp_startmoney ')) {
    return 'Set sudden death start money';
  }

  if (trimmed.startsWith('changelevel ') || trimmed.startsWith('host_workshop_map ')) {
    return 'Change map';
  }

  return 'Server action';
}

function addCommand(command) {
  const timestamp = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const activityLabel = getActivityLabel(command);
  const lineIndex = consoleLines.push(`[${timestamp}] ${activityLabel}`) - 1;
  consoleBox.textContent = consoleLines.join('\n');
  consoleBox.scrollTop = consoleBox.scrollHeight;

  if (command.trim().startsWith('#')) return;

  requestCommandPreview(command)
    .then(() => {
      consoleLines[lineIndex] = `[${timestamp}] ${activityLabel}`;
      consoleBox.textContent = consoleLines.join('\n');
      consoleBox.scrollTop = consoleBox.scrollHeight;
    })
    .catch(() => {
      consoleLines[lineIndex] = `[${timestamp}] ${activityLabel}`;
      consoleBox.textContent = consoleLines.join('\n');
    });
}

function clearConsole() {
  consoleLines = [];
  consoleBox.textContent = 'Activity will appear here.';
}

async function copyConsole() {
  const text = consoleLines.join('\n');
  if (!text) return;
  await navigator.clipboard.writeText(text);
  addCommand('# Copied activity log to clipboard');
}

mapSearch.addEventListener('input', renderMaps);

if (inventoryList) {
  inventoryList.addEventListener('click', event => {
    const favoriteButton = event.target.closest('button[data-action="toggle-favorite"]');
    if (favoriteButton) {
      toggleMapFavorite(favoriteButton.dataset.mapKey);
      return;
    }

    const button = event.target.closest('button[data-action="add-inventory"]');
    if (!button) return;
    const mapName = button.dataset.map;
    addInventoryMap(mapName);
  });
}

if (mapList) {
  mapList.addEventListener('click', event => {
    const favoriteButton = event.target.closest('button[data-action="toggle-favorite"]');
    if (!favoriteButton) return;
    toggleMapFavorite(favoriteButton.dataset.mapKey);
  });
}

if (cycleList) {
  cycleList.addEventListener('click', event => {
    const favoriteButton = event.target.closest('button[data-action="toggle-favorite"]');
    if (!favoriteButton) return;
    toggleMapFavorite(favoriteButton.dataset.mapKey);
  });
}

if (availableFilterButtons) {
  availableFilterButtons.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    setAvailableFilter(button.dataset.filter);
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
  csApiSendMessageBtn.addEventListener('click', async () => {
    const success = await sendFormattedServerMessage(csApiMessageInput?.value || '');
    if (success && csApiMessageInput) {
      csApiMessageInput.value = '';
    }
  });
}

if (compactModeToggle) {
  compactModeToggle.addEventListener('change', (event) => {
    setCompactMode(event.target.checked);
    const savedDiag = loadDiagnosticsCollapsed();
    if (savedDiag === null && event.target.checked) {
      applyDiagnosticsCollapsed(true);
    }
    const savedAvail = loadAvailableCollapsed();
    if (savedAvail === null && event.target.checked) {
      applyAvailableCollapsed(true);
    }
    const savedSelect = loadSelectCollapsed();
    if (savedSelect === null && event.target.checked) {
      applySelectCollapsed(true);
    }
    const savedLibrary = loadLibraryCollapsed();
    if (savedLibrary === null && event.target.checked) {
      applyLibraryCollapsed(true);
    }
  });
}

if (diagnosticsToggle) {
  diagnosticsToggle.addEventListener('change', (event) => {
    setDiagnosticsCollapsed(event.target.checked);
  });
}

if (availableToggle) {
  availableToggle.addEventListener('change', (event) => {
    setAvailableCollapsed(event.target.checked);
  });
}

if (selectToggle) {
  selectToggle.addEventListener('change', (event) => {
    setSelectCollapsed(event.target.checked);
  });
}

if (libraryToggle) {
  libraryToggle.addEventListener('change', (event) => {
    setLibraryCollapsed(event.target.checked);
  });
}

if (cycleList) {
  cycleList.addEventListener('dragstart', (event) => {
    const item = event.target.closest('.cycle-item');
    if (!item) return;

    draggedCycleIndex = Number(item.dataset.cycleIndex);
    cycleDropIndex = draggedCycleIndex;
    item.classList.add('cycle-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(draggedCycleIndex));
  });

  cycleList.addEventListener('dragover', (event) => {
    if (draggedCycleIndex === null) return;

    const item = event.target.closest('.cycle-item');
    if (!item) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const dropTarget = getCycleDropIndex(event, item);
    cycleDropIndex = dropTarget.index;
    setCycleDropFeedback(item, dropTarget.position);
  });

  cycleList.addEventListener('drop', async (event) => {
    if (draggedCycleIndex === null || cycleDropIndex === null) return;

    event.preventDefault();
    const fromIndex = draggedCycleIndex;
    const toIndex = cycleDropIndex;
    draggedCycleIndex = null;
    cycleDropIndex = null;
    clearCycleDropFeedback();
    await reorderCycle(fromIndex, toIndex);
  });

  cycleList.addEventListener('dragend', () => {
    draggedCycleIndex = null;
    cycleDropIndex = null;
    clearCycleDropFeedback();
    cycleList.querySelectorAll('.cycle-dragging').forEach(item => {
      item.classList.remove('cycle-dragging');
    });
  });
}

setCompactMode(loadCompactMode());
initializeDiagnosticsState();
initializeAvailableState();
initializeSelectState();
initializeLibraryState();

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

  const success = await sendFormattedServerMessage(message);
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

async function initializeApp() {
  renderMaps();
  renderInventory();
  renderCycle();

  try {
    await loadSharedMapState();
    renderMaps();
    renderInventory();
    renderCycle();
  } catch (err) {
    showSharedMapStateError(err, 'load');
  }

  refreshServerStatus();
}

initializeApp();
