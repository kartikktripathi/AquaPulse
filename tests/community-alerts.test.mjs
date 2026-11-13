import assert from 'node:assert/strict';
import test from 'node:test';
import { getCommunityAlerts } from '../src/utils/communityAlerts.js';
import { HELP_CONTACTS } from '../src/data/helpContacts.js';

const reports = [
  { id: 'flood', categoryId: 'waterlogging', severity: 'high', status: 'reported', addressLine1: 'Lake Road' },
  { id: 'pipe', categoryId: 'pipe_burst', severity: 'medium', status: 'verified', landmark: 'Lake Road' },
  { id: 'pressure', categoryId: 'low_pressure', status: 'in_progress' },
  { id: 'done', categoryId: 'pipe_burst', severity: 'high', status: 'resolved' },
  { id: 'fixed', status: 'fixed' }, { id: 'unknown', status: 'not-a-status' }, null,
];
const ids = (rows) => rows.map((row) => row.id);
test('alerts include only known open statuses and support legacy verified/resolved aliases', () => {
  const before = structuredClone(reports);
  assert.deepEqual(ids(getCommunityAlerts(reports)), ['flood', 'pipe', 'pressure']);
  assert.deepEqual(reports, before);
});
test('high severity and supply-related filters describe only matching community reports', () => {
  assert.deepEqual(ids(getCommunityAlerts(reports, { mode: 'urgent' })), ['flood']);
  assert.deepEqual(ids(getCommunityAlerts(reports, { mode: 'supply' })), ['pipe', 'pressure']);
});
test('area search combines with alert modes and handles empty data', () => {
  assert.deepEqual(ids(getCommunityAlerts(reports, { mode: 'supply', area: ' LAKE road ' })), ['pipe']);
  assert.deepEqual(getCommunityAlerts(reports, { area: 'Nowhere' }), []);
  assert.deepEqual(getCommunityAlerts(null), []);
});
test('contact dial targets are numeric and all contacts expose region and official source', () => {
  for (const contact of HELP_CONTACTS) {
    assert.match(contact.dial, /^\d+$/);
    assert.equal(contact.number.replace(/\D/g, ''), contact.dial);
    assert.ok(contact.region);
    assert.match(new URL(contact.source).hostname, /\.(gov\.in)$/);
  }
});
