import { getCategoryMeta, getStatusMeta, parsePhotos } from './categoryMeta.js';
import { getNearbyPhotoUri, getReportCoordinates } from './nearbyReports.js';
import { normalizeReportStatus } from './reportFilters.js';
import { DEPTH_OPTIONS, PEOPLE_OPTIONS, ROAD_OPTIONS, SEVERITY_META } from './severity.js';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const timestamp = (value) => typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
export const REPORT_SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' }, { id: 'oldest', label: 'Oldest' }, { id: 'severity', label: 'Highest severity' },
];

export function getReportPhotos(value) {
  return [...new Set(parsePhotos(value).map((uri) => getNearbyPhotoUri([uri])).filter(Boolean))];
}

export function getReportDetails(report = {}) {
  report = report && typeof report === 'object' && !Array.isArray(report) ? report : {};
  const address = report.address && typeof report.address === 'object' ? report.address : {};
  const severityId = text(report.severity).toLowerCase();
  const optionLabel = (options, value) => options.find((option) => option.id === text(value).toLowerCase())?.label || 'Not recorded';
  return {
    id: typeof report.id === 'string' || typeof report.id === 'number' ? String(report.id) : '',
    name: text(report.name) || 'Untitled water issue',
    category: getCategoryMeta(report),
    status: getStatusMeta(normalizeReportStatus(report.status)),
    severity: Object.hasOwn(SEVERITY_META, severityId) ? SEVERITY_META[severityId]
      : { label: 'Not recorded', color: '#627083', bg: '#f0f3f7' },
    address: [text(report.addressLine1) || text(address.line1), text(report.addressLine2) || text(address.line2)].filter(Boolean).join(', '),
    landmark: text(report.landmark) || text(address.landmark),
    description: text(report.description) || 'No description provided.',
    createdAt: Number.isFinite(timestamp(report.createdAt)) ? new Date(report.createdAt).toLocaleString() : 'Date unavailable',
    waterDepth: optionLabel(DEPTH_OPTIONS, report.waterDepth),
    peopleAffected: optionLabel(PEOPLE_OPTIONS, report.peopleAffected),
    roadBlocked: optionLabel(ROAD_OPTIONS, report.roadBlocked),
    coordinates: getReportCoordinates(report),
    photos: getReportPhotos(report.photos),
  };
}

export function searchAndSortReports(reports, query = '', sort = 'newest') {
  const words = text(query).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = (Array.isArray(reports) ? reports : []).filter((report) => {
    if (!report || typeof report !== 'object' || Array.isArray(report)) return false;
    const address = report.address || {};
    const searchable = [report.name, report.description, report.addressLine1, report.addressLine2, report.landmark,
      address.line1, address.line2, address.landmark, report.categoryLabel, getCategoryMeta(report).label]
      .map(text).join(' ').toLocaleLowerCase();
    return words.every((word) => searchable.includes(word));
  });
  const severityRank = (report) => ['low', 'medium', 'high'].indexOf(text(report.severity).toLowerCase()) + 1;
  return result.sort((a, b) => {
    if (sort === 'severity') {
      const severityDifference = severityRank(b) - severityRank(a);
      if (severityDifference) return severityDifference;
    }
    const aTime = timestamp(a.createdAt), bTime = timestamp(b.createdAt);
    // Unknown dates always go last, including when sorting oldest first.
    if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : 0;
    if (!Number.isFinite(bTime)) return -1;
    return sort === 'oldest' ? aTime - bTime : bTime - aTime;
  });
}
