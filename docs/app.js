const STORAGE_KEYS = {
  maps: 'farmorops.mapLibrary',
  cycle: 'farmorops.mapCycle'
};

const defaultMaps = [
  { name: 'de_mirage', type: 'standard', value: 'de_mirage' },
  { name: 'de_inferno', type: 'standard', value: 'de_inferno' },
  { name: 'de_dust2', type: 'standard', value: 'de_dust2' },
  { name: 'de_nuke', type: 'standard', value: 'de_nuke' },
  { name: 'de_vertigo', type: 'standard', value: 'de_vertigo' },
  { name: 'de_ancient', type: 'standard', value: 'de_ancient' },
  { name: 'de_anubis', type: 'standard', value: 'de_anubis' },
  { name: 'de_overpass', type: 'standard', value: 'de_overpass' },
  { name: 'cs_office', type: 'standard', value: 'cs_office' },
  { name: 'cs_italy', type: 'standard', value: 'cs_italy' },
  { name: 'aim_redline', type: 'workshop', value: '3070244462' },
  { name: 'awp_lego_2', type: 'workshop', value: '3070251264' },
  { name: 'fy_pool_day', type: 'workshop', value: '3070286877' }
];

let maps = loadStoredMaps();
let cycle = loadStoredCycle();
let consoleLines = [];

const mapList = document.getElementById('mapList');
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

function loadStoredMaps() {
  const savedMaps = readStorage(STORAGE_KEYS.maps, null);
  return Array.isArray(savedMaps) && savedMaps.every(isValidMap)
    ? savedMaps
    : [...defaultMaps];
}

function loadStoredCycle() {
  const savedCycle = readStorage(STORAGE_KEYS.cycle, []);
  return Array.isArray(savedCycle) && savedCycle.every(map => typeof map === 'string')
    ? savedCycle
    : [];
}

function saveMaps() {
  writeStorage(STORAGE_KEYS.maps, maps);
}

function saveCycle() {
  writeStorage(STORAGE_KEYS.cycle, cycle);
}

function renderMaps() {
  const query = mapSearch.value.toLowerCase().trim();
  const filtered = maps.filter(map => map.name.toLowerCase().includes(query) || map.value.toLowerCase().includes(query));

  mapList.innerHTML = filtered.map(map => `
    <div class="map-row">
      <span>
        <span class="map-name">${map.name}</span><br>
        <small style="color: var(--muted)">${map.type === 'workshop' ? 'Workshop ID: ' + map.value : 'Standard map'}</small>
      </span>
      <button onclick="addMapToCycle('${map.name}')">Add</button>
    </div>
  `).join('');
}

function renderCycle() {
  if (!cycle.length) {
    cycleList.innerHTML = '<div class="empty">Inga banor valda ännu. Lägg till banor från listan till vänster.</div>';
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
renderCycle();
