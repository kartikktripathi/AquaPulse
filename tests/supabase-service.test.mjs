import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { readCoordinates } from '../src/utils/nearbyReports.js';

async function loadModule(path, mocks) {
  const context = vm.createContext({ AbortController, Date, Promise, setTimeout, clearTimeout, atob,
    console: { log() {}, warn() {}, error() {} } });
  const module = new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), { context });
  await module.link((specifier) => {
    const values = mocks[specifier];
    if (!values) throw new Error(`Unexpected dependency: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(values), function () {
      Object.entries(values).forEach(([key, value]) => this.setExport(key, value));
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

function clientMock({ rows = [], failRead = false, insertError = null, photoError = null } = {}) {
  const state = { rows, failRead, insertError, photoError, inserts: [], updates: [], ranges: [], uploads: [] };
  const client = {
    from(table) {
      assert.equal(table, 'Report');
      let payload;
      let updatePayload;
      let start = 0;
      let end = 499;
      let signal;
      const query = {
        insert(value) { payload = value[0]; state.inserts.push(payload); return query; },
        update(value) { updatePayload = value; state.updates.push(value); return query; },
        eq(col, val) { return query; },
        select() { return query; },
        order() { return query; },
        range(from, to) { start = from; end = to; state.ranges.push([from, to]); return query; },
        abortSignal(value) { signal = value; return query; },
        async single() {
          if (state.insertError) return { error: state.insertError };
          if (updatePayload) return { data: { ...(state.rows[0] || {}), ...updatePayload } };
          return { data: payload || state.rows[0] };
        },
        then(resolve, reject) {
          return Promise.resolve(state.failRead || signal?.aborted
            ? { data: null, error: { message: 'TypeError: fetch failed' } }
            : { data: state.rows.slice(start, end + 1), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'report-photos');
        return {
          async upload(path, bytes, options) {
            state.uploads.push({ path, bytes, options });
            return { error: state.photoError };
          },
          getPublicUrl(path) { return { data: { publicUrl: `https://example.test/${path}` } }; },
        };
      },
    },
  };
  return { client, state };
}

const serviceFor = (supabase) => loadModule('../src/services/reportService.js', {
  '../lib/supabase.js': { supabase }, '../utils/nearbyReports.js': { readCoordinates },
});
const report = {
  name: 'Test leak', latitude: 19, longitude: 72, categoryId: 'pipe_leakage', photos: [],
  waterDepth: 'knee', peopleAffected: 'many', roadBlocked: 'blocked', severity: 'high',
};

test('a successful insert returns the shared report and can be read from offline cache', async () => {
  const { client, state } = clientMock();
  const service = await serviceFor(client);
  const result = await service.saveReportToDatabase(report);
  assert.equal(result.success, true);
  assert.equal(result.report.name, report.name);
  assert.equal(state.inserts.length, 1);
  for (const field of ['waterDepth', 'peopleAffected', 'roadBlocked', 'severity']) {
    assert.equal(state.inserts[0][field], report[field]);
    assert.equal(result.report[field], report[field]);
  }
  state.failRead = true;
  const cached = await service.getReportsSnapshot();
  assert.equal(cached.source, 'cache');
  assert.equal(cached.reports[0].id, result.report.id);
});

test('failed inserts are not shown as saved or added to the report cache', async () => {
  const { client } = clientMock({ insertError: { message: 'Permission denied' }, failRead: true });
  const service = await serviceFor(client);
  assert.equal((await service.saveReportToDatabase(report)).success, false);
  const snapshot = await service.getReportsSnapshot();
  assert.equal(snapshot.reports.length, 0);
  assert.equal(snapshot.source, 'unavailable');
});

test('all pages are fetched and legacy list callers still receive an array', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ ...report, id: String(index), photos: '[]' }));
  const { client, state } = clientMock({ rows });
  const service = await serviceFor(client);
  const result = await service.getReportsFromDatabase();
  assert.equal(result.length, 501);
  assert.deepEqual(state.ranges, [[0, 499], [500, 999]]);
});

test('empty success, cached data and unavailable service stay distinct', async () => {
  const { client, state } = clientMock();
  const service = await serviceFor(client);
  assert.equal((await service.getReportsSnapshot()).source, 'network');
  state.failRead = true;
  assert.equal((await service.getReportsSnapshot()).source, 'cache');
  const unavailable = await serviceFor(client);
  assert.equal((await unavailable.getReportsSnapshot()).source, 'unavailable');
  await assert.rejects(unavailable.getReportsFromDatabase(), /Could not reach Supabase/);
});

test('missing configuration has an actionable error and never claims success', async () => {
  const service = await serviceFor(null);
  assert.match((await service.saveReportToDatabase(report)).error, /EXPO_PUBLIC_SUPABASE_URL/);
  await assert.rejects(service.getReportsFromDatabase(), /not configured/);
});

test('cancelled fetch does not issue queries or replace existing cache', async () => {
  const { client, state } = clientMock({ rows: [{ ...report, id: 'kept' }] });
  const service = await serviceFor(client);
  await service.getReportsSnapshot();
  const controller = new AbortController();
  controller.abort();
  const result = await service.getReportsSnapshot({ signal: controller.signal });
  assert.equal(result.source, 'cache');
  assert.equal(result.reports[0].id, 'kept');
  assert.equal(state.ranges.length, 1);
});

test('invalid coordinates stay absent instead of becoming false zero-distance reports', async () => {
  const { client, state } = clientMock();
  const service = await serviceFor(client);
  assert.equal(service.formatSupabaseReport({ latitude: null, longitude: null }).latitude, null);
  assert.equal((await service.saveReportToDatabase({ ...report, latitude: null })).success, false);
  assert.equal(state.inserts.length, 0);
});

test('base64 photo uploads preserve MIME and save only remote photo URLs', async () => {
  const { client, state } = clientMock();
  const service = await serviceFor(client);
  const result = await service.saveReportToDatabase({ ...report, photos: ['data:image/png;base64,aGVsbG8='] });
  assert.equal(result.success, true);
  assert.equal(state.uploads[0].options.contentType, 'image/png');
  assert.equal(state.uploads[0].bytes.byteLength, 5);
  assert.match(result.report.photos[0], /^https:\/\//);
});

test('photo upload errors stop insertion without privileged client fallback', async () => {
  const { client, state } = clientMock({ photoError: { message: 'row-level security blocked upload' } });
  const service = await serviceFor(client);
  const result = await service.saveReportToDatabase({ ...report, photos: ['data:image/png;base64,aGVsbG8='] });
  assert.equal(result.success, false);
  assert.match(result.error, /Photo upload failed/);
  assert.equal(state.inserts.length, 0);
  assert.equal(state.uploads.length, 1);
});

test('location permission denial does not request a GPS fix', async () => {
  const service = await loadModule('../src/services/nearbyLocation.js', {
    'expo-location': {
      getForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: false }),
      getCurrentPositionAsync: () => { assert.fail('No location access'); },
    }, '../utils/nearbyReports.js': { readCoordinates },
  });
  await assert.rejects(service.getNearbyLocation(), (error) => error.code === 'permission');
});

test('addPhotosToReport uploads photos and appends to existing report photos list', async () => {
  const existingReport = { ...report, id: 'rep-existing', photos: '["https://example.test/photo1.jpg"]' };
  const { client, state } = clientMock({ rows: [existingReport] });
  const service = await serviceFor(client);
  const result = await service.addPhotosToReport('rep-existing', ['data:image/png;base64,aGVsbG8=']);
  assert.equal(result.success, true);
  assert.equal(result.photos.length, 2);
  assert.equal(result.photos[0], 'https://example.test/photo1.jpg');
  assert.match(result.photos[1], /^https:\/\//);
  assert.equal(state.updates.length, 1);
});
