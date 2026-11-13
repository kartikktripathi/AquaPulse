import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mapHtml } from '../src/utils/mapHtml.js';

// Execute the actual embedded map script against a small Leaflet/DOM test double.
function bootMap() {
  const createdMarkers = [];
  const fits = [];
  const map = { setView() { return this; }, on() {}, invalidateSize() {}, flyTo() {},
    fitBounds(bounds) { fits.push(bounds); }, distance() { return 0; } };
  const layer = { markers: [], addTo() { return this; }, clearLayers() { this.markers = []; },
    getLayers() { return this.markers; }, getBounds() { return this.markers.map((m) => m.coords); } };
  const element = (tag) => ({ tag, style: {}, children: [], appendChild(child) { this.children.push(child); },
    set innerHTML(_) { throw new Error('Untrusted HTML must not be inserted'); } });
  const context = vm.createContext({ console, setTimeout() {}, window: { addEventListener() {} },
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
  return { context, layer, createdMarkers, fits, send: (data) => context.handleMessage({ data }) };
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
