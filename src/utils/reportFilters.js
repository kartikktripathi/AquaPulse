import { FILTER_CATEGORIES, getCategoryMeta, getStatusMeta, getUiCategoryId, parsePhotos } from './categoryMeta.js';
import { getNearbyPhotoUri, getReportCoordinates } from './nearbyReports.js';
import { DEPTH_OPTIONS, PEOPLE_OPTIONS, ROAD_OPTIONS, SEVERITY_META } from './severity.js';

export const CATEGORY_OPTIONS = [...FILTER_CATEGORIES.slice(1),
  { id: 'other', label: 'Other water issue', color: '#8E8E93' }];
export const SEVERITY_OPTIONS = ['all', 'low', 'medium', 'high', 'unknown'].map((id) => ({
  id, label: id === 'all' ? 'Any severity' : id === 'unknown' ? 'Not recorded' : id[0].toUpperCase() + id.slice(1),
}));
export const STATUS_OPTIONS = [
  { id: 'all', label: 'Any status' },
  ...['reported', 'review', 'in_progress', 'fixed'].map((id) => ({ id, label: getStatusMeta(id).label })),
];
export const DATE_OPTIONS = [
  { id: 'all', label: 'All time' }, { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 days' }, { id: '30days', label: 'Last 30 days' },
  { id: 'custom', label: 'Date range' },
];
export const createReportFilters = () => ({ categories: [], severity: 'all', status: 'all', date: 'all', from: '', to: '', area: '' });
const clean = (value) => typeof value === 'string' ? value.trim() : '';

export function normalizeReportStatus(value) {
  const status = clean(value).toLowerCase();
  return status === 'resolved' ? 'fixed' : status === 'verified' ? 'review' : status;
}

// Parse a calendar date in the device's timezone, avoiding UTC-only date parsing.
export function parseFilterDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(0);
  result.setFullYear(year, month - 1, day);
  result.setHours(0, 0, 0, 0);
  return year >= 1 && result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day
    ? result : null;
}

export function validateReportFilters(filters) {
  if (filters.date !== 'custom') return null;
  const from = parseFilterDate(filters.from);
  const to = parseFilterDate(filters.to);
  if (!from || !to) return 'Enter valid start and end dates as YYYY-MM-DD.';
  if (from > to) return 'The end date must be on or after the start date.';
  return null;
}

export function getFilterDateBounds(filters, now = new Date()) {
  if (filters.date === 'all') return null;
  if (filters.date === 'custom') {
    if (validateReportFilters(filters)) return null;
    const end = parseFilterDate(filters.to);
    end.setDate(end.getDate() + 1);
    return { from: +parseFilterDate(filters.from), until: +end };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = filters.date === '7days' ? 7 : filters.date === '30days' ? 30 : 1;
  start.setDate(start.getDate() - days + 1);
  return { from: +start, until: +now + 1 };
}

export function filterReports(reports, filters = createReportFilters(), now = new Date()) {
  if (!Array.isArray(reports) || validateReportFilters(filters)) return [];
  const bounds = getFilterDateBounds(filters, now);
  const areaWords = clean(filters.area).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return reports.filter((report) => {
    if (!report || typeof report !== 'object') return false;
    if (filters.categories.length && !filters.categories.includes(getUiCategoryId(report))) return false;
    const rawSeverity = clean(report.severity).toLowerCase();
    const severity = ['low', 'medium', 'high'].includes(rawSeverity) ? rawSeverity : 'unknown';
    if (filters.severity !== 'all' && severity !== filters.severity) return false;
    if (filters.status !== 'all' && normalizeReportStatus(report.status) !== filters.status) return false;
    if (bounds) {
      const created = typeof report.createdAt === 'string' && report.createdAt.trim() ? Date.parse(report.createdAt) : NaN;
      if (!Number.isFinite(created) || created < bounds.from || created >= bounds.until) return false;
    }
    const address = [report.addressLine1, report.addressLine2, report.landmark,
      report.address?.line1, report.address?.line2, report.address?.landmark].map(clean).join(' ').toLocaleLowerCase();
    return areaWords.every((word) => address.includes(word));
  });
}

export function getActiveFilterCount(filters) {
  return Number(filters.categories.length > 0) + Number(filters.severity !== 'all') +
    Number(filters.status !== 'all') + Number(filters.date !== 'all') + Number(Boolean(clean(filters.area)));
}

export function getFilterSummary(filters) {
  const labels = filters.categories.map((id) => CATEGORY_OPTIONS.find((c) => c.id === id)?.label).filter(Boolean);
  if (filters.severity !== 'all') labels.push(SEVERITY_OPTIONS.find((o) => o.id === filters.severity)?.label);
  if (filters.status !== 'all') labels.push(STATUS_OPTIONS.find((o) => o.id === filters.status)?.label);
  if (filters.date !== 'all') labels.push(filters.date === 'custom' ? `${filters.from} – ${filters.to}` : DATE_OPTIONS.find((o) => o.id === filters.date)?.label);
  if (clean(filters.area)) labels.push(`Area: ${clean(filters.area)}`);
  return labels.filter(Boolean).join(' · ');
}

// Only the filtered, valid coordinates reach Leaflet. List-only reports stay visible in the list.
export function getMapReports(reports) {
  return reports.flatMap((report) => {
    const coords = getReportCoordinates(report);
    if (!coords) return [];
    const category = getCategoryMeta(report);
    const rawSeverity = clean(report.severity).toLowerCase();
    const severity = ['low', 'medium', 'high'].includes(rawSeverity) ? rawSeverity : 'Not recorded';
    const severityMeta = SEVERITY_META[rawSeverity] || { label: 'Not recorded', color: '#627083', bg: '#f0f3f7' };
    const statusMeta = getStatusMeta(normalizeReportStatus(report.status));
    const optionLabel = (options, value) => options.find((o) => o.id === clean(value).toLowerCase())?.label || null;
    const photos = [...new Set(parsePhotos(report.photos).map((uri) => getNearbyPhotoUri([uri])).filter(Boolean))];

    return [{
      ...coords,
      id: report.id,
      name: clean(report.name) || 'Untitled water issue',
      category: category.label,
      color: category.color,
      status: statusMeta.label,
      statusColor: statusMeta.color,
      statusBg: statusMeta.bg,
      severity,
      severityLabel: severityMeta.label,
      severityColor: severityMeta.color,
      severityBg: severityMeta.bg,
      description: clean(report.description),
      address: [report.addressLine1 || report.address?.line1, report.addressLine2 || report.address?.line2, report.landmark || report.address?.landmark].map(clean).filter(Boolean).join(', '),
      addressLine: [clean(report.addressLine1 || report.address?.line1), clean(report.addressLine2 || report.address?.line2)].filter(Boolean).join(', '),
      landmark: clean(report.landmark || report.address?.landmark),
      date: report.createdAt && Number.isFinite(Date.parse(report.createdAt)) ? new Date(report.createdAt).toLocaleDateString() : 'Date unavailable',
      formattedDate: report.createdAt && Number.isFinite(Date.parse(report.createdAt)) ? new Date(report.createdAt).toLocaleString() : null,
      waterDepth: optionLabel(DEPTH_OPTIONS, report.waterDepth),
      peopleAffected: optionLabel(PEOPLE_OPTIONS, report.peopleAffected),
      roadBlocked: optionLabel(ROAD_OPTIONS, report.roadBlocked),
      photos,
      rawReport: report,
    }];
  });
}
