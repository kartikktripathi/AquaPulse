import assert from 'node:assert/strict';
import test from 'node:test';
import { createReportFilters, filterReports, getActiveFilterCount, getFilterDateBounds,
  getFilterSummary, getMapReports, parseFilterDate, validateReportFilters } from '../src/utils/reportFilters.js';

const defaults = createReportFilters;
const apply = (reports, overrides, now) => filterReports(reports, { ...defaults(), ...overrides }, now);
const ids = (reports) => reports.map((r) => r.id);
const reports = [
  { id: 'flood', categoryId: 'waterlogging', severity: 'high', status: 'reported', addressLine1: 'Lake Road', landmark: 'Lohegaon', latitude: 0, longitude: 0 },
  { id: 'pipe', categoryId: 'pipe_burst', severity: 'medium', status: 'resolved', addressLine1: 'High Street', latitude: '18.5', longitude: '73.9' },
  { id: 'drain', categoryId: 'drain_blockage', severity: 'low', status: 'verified', address: { line1: 'LAKE road', landmark: 'Station' } },
  { id: 'unknown', categoryId: 'old-id', status: 'reported', severity: null },
];

test('default and reset retain all reports, preserve ordering and do not mutate input', () => {
  const before = structuredClone(reports);
  assert.deepEqual(apply(reports, {}), reports);
  const selection = defaults(); selection.categories.push('pipe_leakage');
  assert.deepEqual(defaults().categories, []);
  assert.deepEqual(reports, before);
  assert.deepEqual(apply(null, {}), []);
});

test('categories use OR within selection and AND across severity/status/area', () => {
  assert.deepEqual(ids(apply(reports, { categories: ['urban_flooding', 'pipe_leakage'] })), ['flood', 'pipe']);
  assert.deepEqual(ids(apply(reports, { categories: ['urban_flooding', 'pipe_leakage'], severity: 'high', status: 'reported', area: 'lohegaon lake' })), ['flood']);
  assert.deepEqual(ids(apply(reports, { categories: ['urban_flooding'], severity: 'low' })), []);
  assert.deepEqual(ids(apply(reports, { categories: ['other'] })), ['unknown']);
});

test('status aliases and missing severity are filterable', () => {
  assert.deepEqual(ids(apply(reports, { status: 'fixed' })), ['pipe']);
  assert.deepEqual(ids(apply(reports, { status: 'review' })), ['drain']);
  assert.deepEqual(ids(apply(reports, { severity: 'unknown' })), ['unknown']);
  assert.equal(apply([{ severity: ' HIGH ' }], { severity: 'high' }).length, 1);
});

test('area matches all words across flat/nested addresses and landmarks, not report titles', () => {
  assert.deepEqual(ids(apply(reports, { area: '  LAKE   road  ' })), ['flood', 'drain']);
  assert.deepEqual(ids(apply(reports, { area: 'station lake' })), ['drain']);
  assert.equal(apply([{ name: 'Lake Road', addressLine1: {} }], { area: 'Lake' }).length, 0);
  assert.equal(apply([{ addressLine2: 'Ward 2' }], { area: 'ward 2' }).length, 1);
  assert.equal(apply([null, 42, {}], { area: ' ' }).length, 1);
});

test('today starts at local midnight and excludes future or invalid timestamps', () => {
  const now = new Date(2026, 10, 13, 12);
  const dates = [new Date(2026, 10, 12, 23, 59), new Date(2026, 10, 13), now, new Date(2026, 10, 13, 13)];
  const fixtures = dates.map((date, id) => ({ id, createdAt: date.toISOString() }));
  fixtures.push({ id: 'invalid', createdAt: 'bad' }, { id: 'missing' });
  assert.deepEqual(ids(apply(fixtures, { date: 'today' }, now)), [1, 2]);
});

test('last 7 and 30 days include today and have exact lower boundaries', () => {
  const now = new Date(2026, 10, 13, 12);
  for (const [date, days] of [['7days', 7], ['30days', 30]]) {
    const lower = new Date(2026, 10, 13 - days + 1);
    const fixture = [{ id: 'before', createdAt: new Date(+lower - 1).toISOString() },
      { id: 'edge', createdAt: lower.toISOString() }];
    assert.deepEqual(ids(apply(fixture, { date }, now)), ['edge']);
  }
});

test('custom date range includes both full days and rejects impossible/reversed dates', () => {
  const range = { date: 'custom', from: '2026-11-12', to: '2026-11-13' };
  const fixture = [new Date(2026, 10, 12), new Date(2026, 10, 13, 23, 59, 59, 999), new Date(2026, 10, 14)]
    .map((date, id) => ({ id, createdAt: date.toISOString() }));
  assert.deepEqual(ids(apply(fixture, range)), [0, 1]);
  for (const value of ['2026-02-29', '2026-13-01', '2026-11-31', '11/12/2026', '0000-01-01', '']) assert.equal(parseFilterDate(value), null);
  assert.ok(parseFilterDate('2024-02-29'));
  assert.ok(validateReportFilters({ ...range, from: '2026-11-14' }));
  assert.deepEqual(apply(reports, { ...range, to: '' }), []);
});

test('calendar ranges cross daylight saving time without assuming 24-hour days', () => {
  const prior = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const bounds = getFilterDateBounds({ date: 'custom', from: '2026-11-01', to: '2026-11-01' });
    assert.equal(bounds.until - bounds.from, 25 * 60 * 60 * 1000);
  } finally {
    if (prior === undefined) delete process.env.TZ; else process.env.TZ = prior;
  }
});

test('map uses the same filtered set and only skips invalid coordinates', () => {
  const filtered = apply(reports, { categories: ['urban_flooding', 'drain_blockage'] });
  assert.deepEqual(ids(filtered), ['flood', 'drain']);
  assert.deepEqual(ids(getMapReports(filtered)), ['flood']);
  assert.deepEqual(ids(getMapReports(reports)), ['flood', 'pipe']);
  assert.equal(getMapReports(reports)[1].status, 'Resolved');
  assert.equal(getMapReports([{ latitude: 91, longitude: 0 }]).length, 0);
});

test('active filter summaries and reset account for every filter group', () => {
  const selected = { categories: ['urban_flooding', 'pipe_leakage'], severity: 'high', status: 'fixed', date: 'custom', from: '2026-11-01', to: '2026-11-13', area: 'Lohegaon' };
  assert.equal(getActiveFilterCount(selected), 5);
  assert.match(getFilterSummary(selected), /Urban Flooding.*Pipe Leakage.*High.*Resolved.*2026-11-01.*Lohegaon/);
  assert.equal(getActiveFilterCount(defaults()), 0);
  assert.equal(getFilterSummary(defaults()), '');
});
