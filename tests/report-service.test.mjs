import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { readCoordinates } from '../src/utils/nearbyReports.js';

async function loadWithMocks(path, mocks, overrides = {}) {
  const context = vm.createContext({
    AbortController, Date, Error, Promise, console, setTimeout, clearTimeout,
    process: { env: { EXPO_PUBLIC_REPORT_MODE: 'api' } }, ...overrides,
  });
  const module = new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), { context });
  await module.link((specifier) => {
    const exports = mocks[specifier] || (specifier === './localReportStorage' ? {
      readLocalReports: async () => { throw new Error('API mode must not read local demo reports'); },
      writeLocalReport: async () => { throw new Error('API mode must not write local demo reports'); },
    } : null);
    if (!exports) throw new Error(`Unexpected test dependency: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      Object.entries(exports).forEach(([name, value]) => this.setExport(name, value));
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

const reportResponse = (reports) => ({
  ok: true, headers: { get: () => 'application/json' }, json: async () => ({ success: true, reports }),
});

test('local demo submits without HTTP and survives service reloads with photos and coordinates', async () => {
  const storage = {};
  Object.defineProperties(storage, {
    getItem: { value: (key) => storage[key] ?? null },
    setItem: { value: (key, value) => { storage[key] = value; } },
  });
  const adapter = await loadWithMocks('../src/services/localReportStorage.web.js', {}, { window: { localStorage: storage } });
  const create = () => loadWithMocks('../src/services/reportService.js', {
    'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } },
    './localReportStorage': { readLocalReports: adapter.readLocalReports, writeLocalReport: adapter.writeLocalReport },
  }, { process: { env: {} }, fetch: () => { assert.fail('Local mode must not call the API'); } });
  const first = await create();
  const result = await first.saveReportToDatabase({ name: 'Demo leak', latitude: 19, longitude: 72, photos: ['data:image/png;base64,aGVsbG8='] });
  assert.equal(result.success, true);
  assert.equal(result.report.status, 'reported');
  assert.ok(result.report.id.startsWith('local_'));
  const reloaded = await create();
  const snapshot = await reloaded.getReportsSnapshot();
  assert.equal(snapshot.source, 'local');
  assert.equal(snapshot.reports[0].id, result.report.id);
  assert.equal(snapshot.reports[0].latitude, 19);
  assert.equal(snapshot.reports[0].photos.length, 1);
  assert.equal((await reloaded.getReportsFromDatabase()).length, 1);
});

test('local storage quota failures never report submission success', async () => {
  const adapter = await loadWithMocks('../src/services/localReportStorage.web.js', {}, {
    window: { localStorage: { setItem: () => { throw new Error('Quota exceeded'); } } },
  });
  const service = await loadWithMocks('../src/services/reportService.js', {
    'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } },
    './localReportStorage': { readLocalReports: adapter.readLocalReports, writeLocalReport: adapter.writeLocalReport },
  }, { process: { env: {} } });
  const result = await service.saveReportToDatabase({ name: 'Demo' });
  assert.equal(result.success, false);
  assert.match(result.error, /fewer\/smaller photos/);
});

test('native storage writes each report then reads it back while ignoring unfinished writes', async () => {
  const files = new Map([['file:///documents/aquapulse-demo-reports/unfinished.tmp', '{}']]);
  const adapter = await loadWithMocks('../src/services/localReportStorage.js', {
    'expo-file-system/legacy': {
      documentDirectory: 'file:///documents/',
      makeDirectoryAsync: async () => {},
      writeAsStringAsync: async (path, data) => { files.set(path, data); },
      moveAsync: async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); },
      readDirectoryAsync: async (directory) => [...files.keys()].map((path) => path.slice(directory.length)),
      readAsStringAsync: async (path) => files.get(path),
    },
  });
  await adapter.writeLocalReport({ id: 'local_test', name: 'Leak', photos: ['photo'] });
  const reports = await adapter.readLocalReports();
  assert.equal(reports.length, 1);
  assert.equal(reports[0].name, 'Leak');
  assert.equal(reports[0].photos[0], 'photo');
});

async function loadService(fetch) {
  const timers = new Set();
  const service = await loadWithMocks('../src/services/reportService.js', {
    'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } },
  }, {
    fetch,
    setTimeout: (fn, ms) => { const id = setTimeout(fn, ms); timers.add(id); return id; },
    clearTimeout: (id) => { timers.delete(id); clearTimeout(id); },
  });
  return { service, timers };
}

test('network snapshots, offline cache and legacy array return remain compatible', async () => {
  let online = true;
  const rows = [{ id: 'report-1' }];
  const { service, timers } = await loadService(async () => {
    if (!online) throw new Error('offline');
    return reportResponse(rows);
  });
  const first = await service.getReportsSnapshot();
  assert.equal(first.source, 'network');
  assert.equal(first.reports, rows);
  assert.ok(first.fetchedAt);
  online = false;
  const fallback = await service.getReportsSnapshot();
  assert.equal(fallback.source, 'cache');
  assert.equal(fallback.reports, rows);
  assert.equal(fallback.fetchedAt, first.fetchedAt);
  assert.equal(await service.getReportsFromDatabase(), rows);
  assert.equal(timers.size, 0);
});

test('successful empty response differs from never-connected service', async () => {
  const empty = await loadService(async () => reportResponse([]));
  assert.equal((await empty.service.getReportsSnapshot()).source, 'network');
  const offline = await loadService(async () => { throw new Error('offline'); });
  const snapshot = await offline.service.getReportsSnapshot();
  assert.equal(snapshot.source, 'unavailable');
  assert.equal(snapshot.reports.length, 0);
  assert.equal(offline.timers.size, 0);
});

test('aborting a request stops fallback attempts and releases its timer', async () => {
  let calls = 0;
  const { service, timers } = await loadService((_, { signal }) => {
    calls += 1;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  const controller = new AbortController();
  const pending = service.getReportsSnapshot({ signal: controller.signal });
  controller.abort();
  await pending;
  assert.equal(calls, 1);
  assert.equal(timers.size, 0);
  await service.getReportsSnapshot({ signal: controller.signal });
  assert.equal(calls, 1);
});

test('non-JSON and unsuccessful responses are not accepted as empty successful data', async () => {
  const { service, timers } = await loadService(async () => ({ ok: false, headers: { get: () => 'text/html' } }));
  assert.equal((await service.getReportsSnapshot()).source, 'unavailable');
  assert.equal(timers.size, 0);
});

test('each timed-out GET aborts and tries the next configured candidate', async () => {
  let calls = 0;
  let cleared = 0;
  const service = await loadWithMocks('../src/services/reportService.js', {
    'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } },
  }, {
    fetch: (_, { signal }) => {
      calls += 1;
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }));
    },
    setTimeout: (fn) => { queueMicrotask(fn); return 1; },
    clearTimeout: () => { cleared += 1; },
  });
  assert.equal((await service.getReportsSnapshot()).source, 'unavailable');
  assert.equal(calls, 2);
  assert.equal(cleared, 2);
});

const locationMock = (overrides = {}) => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  hasServicesEnabledAsync: async () => true,
  getCurrentPositionAsync: async () => ({ coords: { latitude: 19.07, longitude: 72.88, accuracy: 10 } }),
  ...overrides,
});
const loadLocation = (mock, overrides) => loadWithMocks('../src/services/nearbyLocation.js', {
  'expo-location': mock, '../utils/nearbyReports.js': { readCoordinates },
}, overrides);

test('foreground location returns validated device coordinates and accuracy', async () => {
  const service = await loadLocation(locationMock());
  const position = await service.getNearbyLocation();
  assert.equal(position.latitude, 19.07);
  assert.equal(position.accuracy, 10);
});

test('permission is requested when allowed and new GPS fixes bypass the browser cache', async () => {
  let requests = 0;
  const service = await loadLocation(locationMock({
    getForegroundPermissionsAsync: async () => ({ status: 'undetermined', canAskAgain: true }),
    requestForegroundPermissionsAsync: async () => { requests += 1; return { status: 'granted' }; },
    getCurrentPositionAsync: async (options) => {
      assert.equal(options.maximumAge, 0);
      return { coords: { latitude: 19, longitude: 72 } };
    },
  }));
  const result = await service.getNearbyLocation();
  assert.equal(requests, 1);
  assert.equal(result.latitude, 19);
});

test('permanent permission denial does not re-request and preserves settings guidance', async () => {
  const service = await loadLocation(locationMock({
    getForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: false }),
    requestForegroundPermissionsAsync: async () => { assert.fail('must not request again'); },
  }));
  await assert.rejects(service.getNearbyLocation(), (error) => error.code === 'permission' && error.canAskAgain === false);
});

test('disabled location services are reported before requesting a GPS fix', async () => {
  const service = await loadLocation(locationMock({
    hasServicesEnabledAsync: async () => false,
    getCurrentPositionAsync: async () => { assert.fail('must not request GPS'); },
  }));
  await assert.rejects(service.getNearbyLocation(), (error) => error.code === 'services');
});

test('location wait is bounded when a GPS fix never arrives', async () => {
  let timeoutCallback;
  const service = await loadLocation(locationMock({ getCurrentPositionAsync: () => new Promise(() => {}) }), {
    setTimeout: (fn) => { timeoutCallback = fn; return 1; }, clearTimeout: () => {},
  });
  const pending = service.getNearbyLocation();
  timeoutCallback();
  await assert.rejects(pending, (error) => error.code === 'timeout');
});

test('leaving the screen cancels a pending location read', async () => {
  const service = await loadLocation(locationMock({ getCurrentPositionAsync: () => new Promise(() => {}) }));
  const controller = new AbortController();
  const pending = service.getNearbyLocation({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error.code === 'cancelled');
});
