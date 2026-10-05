const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'docs', 'app.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

function createMapContext() {
  const context = vm.createContext({
    MAP_TAGS: vm.runInNewContext(source.match(/const MAP_TAGS = (.*);/)[1]),
    maps: [],
    inventoryMaps: [],
    escapeHtml: value => value,
    mapSearch: { value: '' },
    mapList: { innerHTML: '' },
    mapTagFilterButtons: { innerHTML: '' },
    mapTagFilter: 'all',
    renderFavoriteButton: () => '',
    getMapIdentity: map => map.id || map.name,
    compareMapsByFavoriteThenName: (a, b) => a.name.localeCompare(b.name),
    escapeAttribute: value => value
  });
  vm.runInContext(
    section('function isValidMap(', 'function createCycleProgressSessionId(')
      + section('function normalizeServerMap(', 'async function refreshServerStatus(')
      + section('function renderMapTagFilters(', 'function renderCycle('),
    context
  );
  return context;
}

test('inventory normalization removes vanity and merges only matching internal identities', () => {
  const context = createMapContext();
  const incoming = [
    { id: 'de_eldorado', name: 'de_eldorado', source: 'BUILTIN' },
    { id: 'alias', name: 'de_eldorado', displayName: 'El Dorado', source: 'BUILTIN' },
    { id: 'de_dust2_vanity', name: 'de_dust2_vanity', source: 'BUILTIN' },
    { id: 'workshop:3408790618', name: 'El Dorado', workshopId: '3408790618', source: 'WORKSHOP' }
  ];
  const maps = context.mergeInventoryMaps(incoming.map(context.normalizeServerMap));
  assert.equal(maps.length, 2);
  const builtin = maps.find(map => map.type === 'standard');
  assert.equal(builtin.name, 'El Dorado');
  assert.equal(builtin.mapName, 'de_eldorado');
  assert.ok(maps.some(map => map.type === 'workshop'));
});

test('multiple tags survive normalization and filters only change visible Maps rows', () => {
  const context = createMapContext();
  const map = context.normalizeStoredMap({
    id: 'de_eldorado', name: 'El Dorado', mapName: 'de_eldorado',
    type: 'standard', value: 'de_eldorado', tags: ['Classic', 'Medium']
  });
  const cycle = ['El Dorado'];
  context.inventoryMaps = [map];
  context.maps = [{ ...map, tags: undefined }];
  context.renderMaps();
  assert.match(context.mapList.innerHTML, /map-tag-badge">Classic/);
  assert.match(context.mapList.innerHTML, /map-tag-badge">Medium/);
  context.mapTagFilter = 'review';
  context.renderMaps();
  assert.doesNotMatch(context.mapList.innerHTML, /class="map-row"/);
  context.mapTagFilter = 'medium';
  context.renderMaps();
  assert.match(context.mapList.innerHTML, /class="map-row"/);
  context.mapTagFilter = 'untagged';
  context.renderMaps();
  assert.doesNotMatch(context.mapList.innerHTML, /class="map-row"/);
  assert.deepEqual(cycle, ['El Dorado']);
  assert.deepEqual(Array.from(context.normalizeStoredMap(JSON.parse(JSON.stringify(map))).tags), ['Classic', 'Medium']);
  assert.deepEqual(Array.from(context.normalizeStoredMap({ ...map, tags: undefined }).tags), []);
});

function createStateContext(storage = new Map(), initialState = {}) {
  const context = createMapContext();
  let serverState = initialState;
  Object.assign(context, {
    cycle: [], cycleProgress: {sessionId: 'test', playedMaps: [], currentMap: ''},
    INVENTORY_MAPS_STORAGE_KEY: 'inventory', SELECTABLE_MAPS_STORAGE_KEY: 'selectable',
    LEGACY_MAP_STORAGE_KEYS: {}, tagEditSaving: false,
    readStorage: (key, fallback) => storage.has(key) ? JSON.parse(storage.get(key)) : fallback,
    writeStorage: (key, value) => storage.set(key, JSON.stringify(value)),
    fetch: async (_url, options) => {
      if (options.method === 'PUT') serverState = JSON.parse(options.body);
      return {ok: true, json: async () => JSON.parse(JSON.stringify(serverState))};
    },
    setImportStatus: () => {}, addCommand: () => {},
    showSharedMapStateError: error => { throw error; },
    renderInventory: () => {}, renderCycle: () => {},
    areSameMapIdentity: (a, b) => a.mapName === b.mapName
  });
  vm.runInContext(section('function createCycleProgressSessionId(', 'function showSharedMapStateError(')
    + section('function isSelectableMap(', 'function getAvailableFilterCounts('), context);
  const listeners = {};
  context.mapList.addEventListener = (name, handler) => { listeners[name] = handler; };
  context.mapList.querySelectorAll = () => [];
  vm.runInContext(section('if (mapList) {', 'if (mapTagFilterButtons) {'), context);
  context.editTag = async (map, tag, checked) => {
    const editor = {dataset: {mapKey: context.getMapIdentity(map)}, querySelectorAll: () => []};
    const checkbox = {dataset: {mapTag: tag}, checked, closest: () => editor};
    await listeners.change({target: {closest: () => checkbox}});
  };
  return context;
}

const boyard = {id: 'boyard', name: 'Boyard', mapName: 'de_boyard', type: 'standard', value: 'de_boyard', tags: []};

test('To be removed supports combined tags, filtering and master inventory persistence', async () => {
  const storage = new Map();
  const context = createStateContext(storage, {availableMaps: [boyard], selectableMaps: [], tonightMapCycle: []});
  await context.loadSharedMapState();
  await context.addInventoryMap('boyard');
  await context.editTag(context.maps[0], 'Large', true);
  await context.editTag(context.maps[0], 'To be removed', true);
  context.mapTagFilter = 'to be removed';
  context.renderMaps();
  assert.match(context.mapTagFilterButtons.innerHTML, /data-tag-filter="to be removed"/);
  assert.match(context.mapList.innerHTML, /map-tag-badge">To be removed/);
  assert.match(context.mapList.innerHTML, /data-map-tag="To be removed" checked/);
  context.mapTagFilter = 'untagged';
  context.renderMaps();
  assert.doesNotMatch(context.mapList.innerHTML, /class="map-row"/);
  await context.removeSelectableMap('Boyard');
  assert.deepEqual(Array.from(context.inventoryMaps[0].tags), ['Large', 'To be removed']);

  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const serverContext = vm.createContext({});
  vm.runInContext(serverSource.slice(serverSource.indexOf('function normalizeMapStatePayload('), serverSource.indexOf('function hasLegacyMapProgress(')), serverContext);
  const persisted = serverContext.normalizeMapStatePayload(JSON.parse(JSON.stringify(context.getCurrentSharedMapState())));
  const reloaded = createStateContext(storage, persisted);
  await reloaded.loadSharedMapState();
  await reloaded.addInventoryMap('boyard');
  assert.deepEqual(Array.from(reloaded.getMapTags(reloaded.maps[0])), ['Large', 'To be removed']);
  assert.equal(Object.hasOwn(reloaded.maps[0], 'tags'), false);
  await reloaded.editTag(reloaded.maps[0], 'To be removed', false);
  await reloaded.loadSharedMapState();
  assert.deepEqual(Array.from(reloaded.getMapTags(reloaded.maps[0])), ['Large']);
  reloaded.mapTagFilter = 'to be removed';
  reloaded.renderMaps();
  assert.doesNotMatch(reloaded.mapList.innerHTML, /class="map-row"/);
});

test('Boyard tags survive selection removal, re-addition and state reload', async () => {
  const storage = new Map();
  const context = createStateContext(storage, {availableMaps: [boyard], selectableMaps: [], tonightMapCycle: []});
  await context.loadSharedMapState();
  await context.addInventoryMap('boyard');
  await context.editTag(context.maps[0], 'Small', true);
  assert.match(context.renderMapTagBadges(context.inventoryMaps[0]), />Small</);
  assert.equal(Object.hasOwn(context.maps[0], 'tags'), false);
  await context.removeSelectableMap('Boyard');
  assert.equal(context.maps.length, 0);
  assert.match(context.renderMapTagBadges(context.inventoryMaps[0]), />Small</);
  await context.addInventoryMap('boyard');
  context.renderMaps();
  assert.match(context.mapList.innerHTML, /map-tag-badge">Small/);
  const reloaded = createStateContext(storage, JSON.parse(JSON.stringify(context.getCurrentSharedMapState())));
  await reloaded.loadSharedMapState();
  assert.deepEqual(Array.from(reloaded.getMapTags(reloaded.maps[0])), ['Small']);
  assert.deepEqual(JSON.parse(storage.get('inventory'))[0].tags, ['Small']);
  assert.equal(Object.hasOwn(JSON.parse(storage.get('selectable'))[0], 'tags'), false);
  await reloaded.editTag(reloaded.maps[0], 'Small', false);
  await reloaded.loadSharedMapState();
  assert.deepEqual(Array.from(reloaded.getMapTags(reloaded.maps[0])), []);
});

test('migration merges selectable tags by mapName despite different display names', async () => {
  const storage = new Map([['selectable', JSON.stringify([{...boyard, name: 'Old Boyard', tags: ['Medium']}])]]);
  const context = createStateContext(storage, {availableMaps: [{...boyard, tags: ['Classic']}], selectableMaps: [{...boyard, name: 'Other Boyard', tags: ['Small']}], tonightMapCycle: []});
  await context.loadSharedMapState();
  assert.equal(context.inventoryMaps.length, 1);
  assert.deepEqual(Array.from(context.inventoryMaps[0].tags), ['Classic', 'Small', 'Medium']);
  assert.equal(Object.hasOwn(context.maps[0], 'tags'), false);
  await context.loadSharedMapState();
  assert.deepEqual(Array.from(context.getMapTags(context.maps[0])), ['Classic', 'Small', 'Medium']);
});
