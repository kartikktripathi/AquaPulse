import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mapHtml } from '../src/utils/mapHtml.js';

// Execute the actual embedded map script against a small Leaflet/DOM test double.
function bootMap() {
  const createdMarkers = [];
  const fits = [];
  const posted = [];
  const map = { setView() { return this; }, on() {}, invalidateSize() {}, flyTo() {},
    fitBounds(bounds) { fits.push(bounds); }, distance() { return 250; } };
  const layer = { markers: [], addTo() { return this; }, clearLayers() { this.markers = []; },
    getLayers() { return this.markers; }, getBounds() { return this.markers.map((m) => m.coords); } };
  const element = (tag) => ({ tag, style: {}, children: [], appendChild(child) { this.children.push(child); },
    set innerHTML(_) { throw new Error('Untrusted HTML must not be inserted'); } });
  const context = vm.createContext({ console, setTimeout() {}, window: {
    addEventListener() {},
    ReactNativeWebView: { postMessage: (msg) => posted.push(typeof msg === 'string' ? JSON.parse(msg) : msg) },
  },
    document: { createElement: element, addEventListener() {} }, L: {
      map: () => map, tileLayer: () => ({ addTo() {} }), featureGroup: () => layer, divIcon: (options) => options,
      circle: () => ({ addTo() { return this; }, setLatLng() {} }),
      marker: (coords, options) => {
        const marker = { coords, options, bindPopup(popup) { this.popup = popup; return this; },
          addTo(target) { if (target === layer) layer.markers.push(this); return this; },
          on() {}, setLatLng(next) { this.coords = next; }, getLatLng() { return { lat: this.coords[0], lng: this.coords[1] }; } };
        createdMarkers.push(marker); return marker;
      },
    } });
  const script = mapHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script, context);
  return { context, layer, createdMarkers, fits, posted, send: (data) => context.handleMessage({ data }) };
}

test('filter updates replace saved map markers without moving GPS or draft pins', () => {
  const { context, layer, fits, send } = bootMap();
  send({ type: 'SET_LOCATION', latitude: 18, longitude: 73 });
  const user = context.userMarker, draft = context.problemMarker;
  send({ type: 'SET_REPORTS', reports: [{ latitude: 0, longitude: 0, name: 'One' }, { latitude: 19, longitude: 74, name: 'Two' }] });
  assert.equal(layer.markers.length, 2);
  send({ type: 'FIT_REPORTS' }); assert.equal(fits.length, 1);
  send({ type: 'SET_REPORTS', reports: [{ latitude: 0, longitude: 0, name: 'One' }, { latitude: null, longitude: 73 }] });
  assert.equal(layer.markers.length, 1);
  assert.equal(context.userMarker, user); assert.equal(context.problemMarker, draft);
  assert.equal(draft.coords[0], 18);
  send({ type: 'SET_REPORTS', reports: [] });
  assert.equal(layer.markers.length, 0);
  send({ type: 'FIT_REPORTS' }); assert.equal(fits.length, 1);
  send({ type: 'PAN_TO_LOCATION', latitude: 20, longitude: 75 });
  assert.equal(user.coords[0], 18);
});

test('saved report popup treats report content as text and prevents clicks from setting a draft pin', () => {
  const { layer, send } = bootMap();
  const attack = '<img src=x onerror=alert(1)>';
  send({ type: 'SET_REPORTS', reports: [{ name: attack, latitude: 0, longitude: 0, category: 'Pipe Leakage', status: 'Reported', severity: 'high' }] });
  assert.equal(layer.markers[0].popup.children[0].textContent, attack);
  assert.equal(layer.markers[0].options.bubblingMouseEvents, false);
});

test('report markers use pin styling and popup exposes full details with action button', () => {
  const { layer, send, posted } = bootMap();
  send({ type: 'SET_LOCATION', latitude: 18.5, longitude: 73.8 });
  const sampleReport = {
    id: 'rep-42',
    name: 'Broken main line',
    category: 'Pipe Leakage',
    color: '#007aff',
    status: 'In Progress',
    statusColor: '#ff9500',
    statusBg: '#fff4e5',
    severity: 'high',
    severityLabel: 'High',
    severityColor: '#dc2626',
    severityBg: '#fee2e2',
    description: 'Fresh water flooding the residential lane.',
    address: 'Near Old Water Tank, Main Road',
    addressLine: 'Main Road',
    landmark: 'Near Old Water Tank',
    waterDepth: 'Knee deep (~1.5 ft)',
    peopleAffected: 'Several (6-20)',
    roadBlocked: 'Blocked',
    photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    formattedDate: '11/13/2026, 2:30 PM',
    date: '11/13/2026',
    latitude: 18.52,
    longitude: 73.85,
  };

  send({ type: 'SET_REPORTS', reports: [sampleReport] });
  assert.equal(layer.markers.length, 1);

  const marker = layer.markers[0];
  // Verify icon size and anchors (pointing to coordinate at bottom center)
  assert.equal(marker.options.icon.iconSize[0], 28);
  assert.equal(marker.options.icon.iconSize[1], 36);
  assert.equal(marker.options.icon.iconAnchor[0], 14);
  assert.equal(marker.options.icon.iconAnchor[1], 33);
  assert.equal(marker.options.icon.popupAnchor[0], 0);
  assert.equal(marker.options.icon.popupAnchor[1], -32);

  // Verify pin marker DOM element structure
  const pinEl = marker.options.icon.html;
  assert.match(pinEl.className, /report-pin-marker/);
  assert.match(pinEl.className, /high-severity/);
  const headEl = pinEl.children[0];
  assert.equal(headEl.className, 'report-pin-head');
  assert.equal(headEl.style.backgroundColor, '#007aff');
  assert.equal(headEl.children[0].className, 'report-pin-dot');

  // Verify popup card elements
  const popup = marker.popup;
  assert.equal(popup.className, 'report-card-popup');
  // Title
  assert.equal(popup.children[0].className, 'report-card-title');
  assert.equal(popup.children[0].textContent, 'Broken main line');

  // Badges row
  const badgesRow = popup.children[1];
  assert.equal(badgesRow.className, 'report-card-badges');
  assert.equal(badgesRow.children.length, 3);
  assert.equal(badgesRow.children[0].textContent, 'Pipe Leakage');
  assert.equal(badgesRow.children[1].textContent, 'High');
  assert.equal(badgesRow.children[2].textContent, 'In Progress');

  // Photo preview is omitted from map popup card
  const photoBox = popup.children.find((c) => c.className === 'report-card-photo-box' || c.tag === 'img');
  assert.equal(photoBox, undefined);

  // Description
  const descEl = popup.children.find((c) => c.className === 'report-card-desc');
  assert.ok(descEl);
  assert.equal(descEl.textContent, 'Fresh water flooding the residential lane.');

  // Location
  const locEl = popup.children.find((c) => c.className === 'report-card-loc');
  assert.ok(locEl);
  assert.equal(locEl.children[0].textContent, 'Main Road');

  // Assessment grid
  const gridEl = popup.children.find((c) => c.className === 'report-card-grid');
  assert.ok(gridEl);
  assert.equal(gridEl.children.length, 3);

  // Meta (date & distance)
  const metaEl = popup.children.find((c) => c.className === 'report-card-meta');
  assert.ok(metaEl);
  assert.match(metaEl.children[0].textContent, /11\/13\/2026/);
  assert.match(metaEl.children[1].textContent, /away/);

  // CTA Button
  const btn = popup.children.find((c) => c.className === 'report-card-btn');
  assert.ok(btn);
  assert.equal(btn.textContent, 'View full details');

  // Clicking CTA posts SELECT_REPORT message
  btn.onclick();
  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, 'SELECT_REPORT');
  assert.equal(posted[0].id, 'rep-42');
});
