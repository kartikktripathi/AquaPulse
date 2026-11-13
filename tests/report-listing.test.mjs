import assert from 'node:assert/strict';
import test from 'node:test';
import { getReportDetails, getReportPhotos, searchAndSortReports } from '../src/utils/reportListing.js';
import { createReportFilters, filterReports } from '../src/utils/reportFilters.js';

const records = [
  { id: 'old', name: 'Broken pipe', categoryId: 'pipe_burst', description: 'Water on the pavement', addressLine1: 'Lake Road', landmark: 'School', severity: 'high', createdAt: '2026-11-10T12:00:00Z' },
  { id: 'new', name: 'Street flooding', categoryId: 'waterlogging', address: { line1: 'Main Street', line2: 'Lohegaon', landmark: 'Library' }, severity: 'medium', createdAt: '2026-11-13T12:00:00Z' },
  { id: 'middle', name: 'Blocked drain', categoryId: 'drainage_overflow', addressLine1: 'Lake Road', severity: 'high', createdAt: '2026-11-12T12:00:00Z' },
  { id: 'unknown', name: 'Old issue', severity: null, createdAt: 'not-a-date' },
];
const ids = (rows) => rows.map((row) => row.id);

test('report search matches all words across names, descriptions, category aliases and address fields', () => {
  assert.deepEqual(ids(searchAndSortReports(records, ' PIPE pavement ')), ['old']);
  assert.deepEqual(ids(searchAndSortReports(records, 'lohegaon library')), ['new']);
  assert.deepEqual(ids(searchAndSortReports(records, 'pipe leakage school')), ['old']);
  assert.deepEqual(ids(searchAndSortReports(records, 'lake road')), ['middle', 'old']);
  assert.deepEqual(searchAndSortReports(records, 'no such report'), []);
  assert.deepEqual(ids(searchAndSortReports(records, '  ')), ['new', 'middle', 'old', 'unknown']);
});

test('search and sorting compose with the shared map filters without dropping or modifying source data', () => {
  const before = structuredClone(records);
  const filtered = filterReports(records, { ...createReportFilters(), categories: ['pipe_leakage', 'drain_blockage'], severity: 'high' });
  assert.deepEqual(ids(searchAndSortReports(filtered, 'lake', 'oldest')), ['old', 'middle']);
  assert.deepEqual(records, before);
  assert.equal(searchAndSortReports(records).length, records.length);
});

test('newest and oldest sorts leave missing/invalid dates last and ties stable', () => {
  assert.deepEqual(ids(searchAndSortReports(records, '', 'oldest')), ['old', 'middle', 'new', 'unknown']);
  const ties = [{ id: 'a', createdAt: records[0].createdAt }, { id: 'b', createdAt: records[0].createdAt }, { id: 'c', createdAt: null }];
  assert.deepEqual(ids(searchAndSortReports(ties)), ['a', 'b', 'c']);
  assert.deepEqual(ids(searchAndSortReports(ties, '', 'oldest')), ['a', 'b', 'c']);
});

test('severity sorting ranks high first, then newest, with unrecorded values last', () => {
  assert.deepEqual(ids(searchAndSortReports(records, '', 'severity')), ['middle', 'old', 'new', 'unknown']);
  const extra = [{ id: 'bad', severity: 'constructor' }, { id: 'low', severity: ' LOW ' }];
  assert.deepEqual(ids(searchAndSortReports(extra, '', 'severity')), ['low', 'bad']);
});

test('details retain full report data and display labels for recorded severity inputs', () => {
  const details = getReportDetails({ ...records[0], status: 'resolved', addressLine2: 'Ward 4', latitude: '0', longitude: '73.4',
    waterDepth: 'knee', peopleAffected: 'many', roadBlocked: 'blocked' });
  assert.equal(details.category.label, 'Pipe Leakage');
  assert.equal(details.status.label, 'Resolved');
  assert.equal(details.severity.label, 'High');
  assert.equal(details.waterDepth, 'Knee-deep');
  assert.equal(details.peopleAffected, 'Many people');
  assert.equal(details.roadBlocked, 'Road blocked');
  assert.equal(details.address, 'Lake Road, Ward 4');
  assert.equal(details.landmark, 'School');
  assert.equal(details.description, records[0].description);
  assert.deepEqual(details.coordinates, { latitude: 0, longitude: 73.4 });
  assert.equal(getReportDetails(records[1]).address, 'Main Street, Lohegaon');
});

test('old or malformed data uses honest fallbacks without inventing coordinates or severity', () => {
  for (const raw of [null, undefined, [], { name: {}, photos: {}, severity: '__proto__', status: 'constructor', latitude: '', longitude: null }]) {
    const details = getReportDetails(raw);
    assert.equal(details.name, 'Untitled water issue');
    assert.equal(details.severity.label, 'Not recorded');
    assert.equal(details.createdAt, 'Date unavailable');
    assert.equal(details.coordinates, null);
    assert.deepEqual(details.photos, []);
  }
  assert.deepEqual(searchAndSortReports([null, 42, [], { name: {}, description: {}, address: {} }], '[object Object]'), []);
  assert.deepEqual(searchAndSortReports(null), []);
});

test('photo gallery preserves all safe unique URIs and rejects malformed or executable sources', () => {
  const photo = 'https://example.test/report.jpg';
  const data = 'data:image/png;base64,aGVsbG8=';
  assert.deepEqual(getReportPhotos(JSON.stringify([photo, data, photo, 'javascript:alert(1)', {}, ''])), [photo, data]);
  assert.deepEqual(getReportPhotos(photo), [photo]);
  for (const value of ['[broken', {}, '', 'data:image/svg+xml,<svg/>', ['data:image/png;base64,undefined']]) assert.deepEqual(getReportPhotos(value), []);
});
