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
    const label = map.type === 'workshop'
      ? 'Workshop ID: ' + map.value
      : 'Standard map';

    return `
      <div class="map-row">
        <span>
          <span class="map-name">${map.name}</span><br>
          <small style="color: var(--muted)">${label}</small>
        </span>
        <button type="button" data-action="add-inventory" data-map="${map.name}" ${selected ? 'disabled' : ''}>
          ${selected ? 'Added' : 'Add'}
        </button>
      </div>
    `;
  }).join('');
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

    return `
      <div class="map-row">
        <span>
          <span class="map-name">${map.name}</span> ${origin}<br>
          <small style="color: var(--muted)">${map.type === 'workshop' ? 'Workshop ID: ' + map.value : 'Standard map'}</small>
        </span>
        <div class="map-actions">
          <button onclick="addMapToCycle('${map.name}')">Add</button>
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

function loadMap(map) {
  document.getElementById('currentMap').textContent = map;
  addCommand(getMapCommand(map));
}

function loadNextMap() {
  if (!cycle.length) {
    addCommand('# No maps in tonight cycle');
    return;
  }

  loadMap(cycle[0]);
}

function generateCycleCommands() {
  if (!cycle.length) {
    addCommand('# No maps selected for cycle');
    return;
  }

  addCommand('# Tonight map cycle');
  cycle.forEach((map, index) => addCommand(`# ${index + 1}. ${getMapCommand(map)}`));
}

function announceCycle() {
  if (!cycle.length) {
    addCommand('# No maps selected for tonight\'s cycle');
    return;
  }

  addCommand("say >>>>> TONIGHT'S MAP CYCLE <<<<<");
  cycle.forEach((map, index) => addCommand(`say ${index + 1}. ${map}`));
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

function sendAnnouncement() {
  const input = document.getElementById('announcementInput');
  const message = input.value.trim();

  if (!message) {
    addCommand('# Announcement message cannot be empty');
    return;
  }

  const command = `say ${message}`;
  addCommand(command);

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
