import { getUiCategoryId } from './categoryMeta.js';
import { calculateDistanceMeters } from './geo.js';

export const NEARBY_RADII = [
  { meters: 500, label: '500 m' },
  { meters: 1000, label: '1 km' },
  { meters: 5000, label: '5 km' },
  { meters: 10000, label: '10 km' },
];

const text = (value) => typeof value === 'string' ? value.trim() : '';

function coordinateNumber(value, limit) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function readCoordinates(value) {
  if (!value || typeof value !== 'object') return null;
  const latitude = coordinateNumber(value.latitude, 90);
  const longitude = coordinateNumber(value.longitude, 180);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

export function getReportCoordinates(report) {
  return readCoordinates(report) || readCoordinates(report?.coordinates);
}

export function normalizeNearbyReport(report) {
  const address = report.address && typeof report.address === 'object' ? report.address : {};
  const rawStatus = text(report.status).toLowerCase();
  return {
    id: typeof report.id === 'string' || typeof report.id === 'number' ? String(report.id) : '',
    name: text(report.name) || 'Untitled water issue',
    categoryId: text(report.categoryId),
    categoryLabel: text(report.categoryLabel),
    status: rawStatus === 'resolved' ? 'fixed' : rawStatus === 'verified' ? 'review' : rawStatus,
    severity: text(report.severity).toLowerCase(),
    addressLine1: text(report.addressLine1) || text(address.line1),
    landmark: text(report.landmark) || text(address.landmark),
    description: text(report.description),
    createdAt: typeof report.createdAt === 'string' ? report.createdAt : null,
    photos: report.photos,
  };
}

export function locateReports(reports, center) {
  const origin = readCoordinates(center);
  const located = [];
  let skippedCount = 0;
  if (!origin || !Array.isArray(reports)) return { located, skippedCount };

  reports.forEach((raw, index) => {
    const coords = getReportCoordinates(raw);
    if (!coords) {
      skippedCount += 1;
      return;
    }
    const report = normalizeNearbyReport(raw);
    const distanceMeters = calculateDistanceMeters(
      origin.latitude, origin.longitude, coords.latitude, coords.longitude, false
    );
    located.push({
      report,
      distanceMeters,
      categoryId: getUiCategoryId(report),
      key: `${report.id || 'report'}_${index}`,
    });
  });
  located.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { located, skippedCount };
}

export function filterNearbyReports(located, { radiusMeters, categoryId = 'all', includeResolved = false }) {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return [];
  return located.filter(({ report, distanceMeters, categoryId: reportCategory }) =>
    distanceMeters <= radiusMeters &&
    (categoryId === 'all' || reportCategory === categoryId) &&
    (includeResolved || report.status !== 'fixed')
  );
}

export function formatNearbyDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return 'Distance unavailable';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function getNearbyPhotoUri(photos) {
  let values = photos;
  if (typeof photos === 'string') {
    try {
      values = JSON.parse(photos);
    } catch {
      values = [photos];
    }
  }
  if (typeof values === 'string') values = [values];
  if (!Array.isArray(values)) return null;
  return values.find((uri) => {
    if (typeof uri !== 'string') return false;
    if (/^(https?:\/\/[^\s]+|file:\/\/\S+|content:\/\/\S+|blob:\S+)$/i.test(uri)) return true;
    const data = uri.match(/^data:image\/(?:jpeg|png|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)$/i);
    if (!data) return false;
    const bytes = data[1].replace(/[\r\n]/g, '');
    return bytes.length > 0 && bytes.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(bytes);
  }) || null;
}
