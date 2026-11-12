import assert from 'node:assert/strict';
import test from 'node:test';
import { getStatusMeta, getUiCategoryId } from '../src/utils/categoryMeta.js';
import {
  filterNearbyReports, formatNearbyDistance, getNearbyPhotoUri,
  getReportCoordinates, locateReports, readCoordinates,
} from '../src/utils/nearbyReports.js';

const origin = { latitude: 0, longitude: 0 };
const latitudeAtMeters = (meters) => meters / 6371000 * 180 / Math.PI;

test('coordinates accept zero and numeric strings in both report shapes', () => {
  assert.deepEqual(readCoordinates({ latitude: ' 0 ', longitude: '72.85' }), { latitude: 0, longitude: 72.85 });
  assert.deepEqual(getReportCoordinates({ coordinates: { latitude: 12, longitude: 77 } }), { latitude: 12, longitude: 77 });
  assert.deepEqual(getReportCoordinates({ latitude: '', longitude: null, coordinates: origin }), origin);
});

test('missing, blank, boolean, nonfinite and out-of-range coordinates are rejected', () => {
  for (const value of [null, undefined, '', ' ', true, false, NaN, Infinity, 'oops', [], {}]) {
    assert.equal(readCoordinates({ latitude: value, longitude: 0 }), null, String(value));
    assert.equal(readCoordinates({ latitude: 0, longitude: value }), null, String(value));
  }
  assert.equal(readCoordinates({ latitude: 90.001, longitude: 0 }), null);
  assert.equal(readCoordinates({ latitude: 0, longitude: -180.001 }), null);
});

test('radius comparison uses exact distance before display rounding', () => {
  const { located } = locateReports([
    { id: 'inside', latitude: latitudeAtMeters(499.8), longitude: 0 },
    { id: 'outside', latitude: latitudeAtMeters(500.2), longitude: 0 },
  ], origin);
  assert.deepEqual(filterNearbyReports(located, { radiusMeters: 500 }).map((r) => r.report.id), ['inside']);
  assert.equal(formatNearbyDistance(located[1].distanceMeters), '500 m');
});

test('nearest-first sorting preserves equal-distance order and original input', () => {
  const reports = [
    { id: 'far', latitude: latitudeAtMeters(1200), longitude: 0 },
    { id: 'near-a', coordinates: { latitude: latitudeAtMeters(100), longitude: 0 } },
    { id: 'near-b', latitude: latitudeAtMeters(100), longitude: 0 },
    { id: 'missing' }, null,
  ];
  const before = structuredClone(reports);
  const { located, skippedCount } = locateReports(reports, origin);
  assert.deepEqual(located.map((r) => r.report.id), ['near-a', 'near-b', 'far']);
  assert.equal(skippedCount, 2);
  assert.deepEqual(reports, before);
  assert.deepEqual(locateReports(reports, null), { located: [], skippedCount: 0 });
});

test('category and resolved filters compose across legacy and current values', () => {
  const { located } = locateReports([
    { id: 'legacy', ...origin, categoryId: 'waterlogging', status: 'reported' },
    { id: 'done', ...origin, categoryId: 'urban_flooding', status: 'resolved' },
    { id: 'fixed', ...origin, categoryId: 'urban_flooding', status: 'fixed' },
    { id: 'other', ...origin, categoryId: 'tanker_disruption', status: 'review' },
  ], origin);
  const options = { radiusMeters: 500, categoryId: 'urban_flooding' };
  assert.deepEqual(filterNearbyReports(located, options).map((r) => r.report.id), ['legacy']);
  assert.equal(filterNearbyReports(located, { ...options, includeResolved: true }).length, 3);
  assert.equal(filterNearbyReports(located, { radiusMeters: 500, categoryId: 'other' })[0].report.id, 'other');
  assert.equal(filterNearbyReports(located, { radiusMeters: NaN }).length, 0);
});

test('malformed optional fields normalize safely and category labels map ponds correctly', () => {
  const { located } = locateReports([{ ...origin, name: {}, categoryId: 4, status: {}, address: { line1: [] }, photos: {} }], origin);
  assert.equal(located[0].report.name, 'Untitled water issue');
  assert.equal(located[0].categoryId, 'other');
  assert.equal(getUiCategoryId({ categoryLabel: 'Overflowing Pond / Lake' }), 'overflowing_pond');
  assert.equal(getUiCategoryId({ categoryId: '__proto__' }), 'other');
  assert.equal(getStatusMeta('constructor').color, '#8E8E93');
});

test('photo parsing accepts supported URIs and ignores malformed JSON and schemes', () => {
  assert.equal(getNearbyPhotoUri('["https://example.test/photo.jpg"]'), 'https://example.test/photo.jpg');
  assert.equal(getNearbyPhotoUri(['javascript:alert(1)', 'data:image/png;base64,aGVsbG8=']), 'data:image/png;base64,aGVsbG8=');
  for (const value of ['[broken', 'null', '{}', '', [], {}, ['not-an-image'], 'data:image/jpeg;base64,undefined']) {
    assert.equal(getNearbyPhotoUri(value), null);
  }
  assert.equal(formatNearbyDistance(1250), '1.3 km');
  assert.equal(formatNearbyDistance(NaN), 'Distance unavailable');
});
