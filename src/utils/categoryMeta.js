/**
 * categoryMeta.js
 * ───────────────
 * Single source of truth for AquaPulse category metadata.
 *
 * Maps the fixed UI categories onto the legacy categoryId values that the
 * existing report-creation form writes, while still displaying every report
 * regardless of how old or unknown its category is.
 */

// ─── UI filter categories (the final intended set) ────────────────────────────

export const FILTER_CATEGORIES = [
  { id: 'all',            label: 'All Reports',                icon: 'apps-outline',                      color: '#1c1c1e' },
  { id: 'urban_flooding', label: 'Urban Flooding',             icon: 'rainy-outline',                     color: '#007AFF' },
  { id: 'drain_blockage', label: 'Drain Blockage',             icon: 'alert-circle-outline',              color: '#FF9500' },
  { id: 'polluted_water', label: 'Polluted / Stagnant Water',  icon: 'warning-outline',                   color: '#5856D6' },
  { id: 'overflowing_pond', label: 'Overflowing Pond / Lake',  icon: 'water-outline',                     color: '#14B8A6' },
  { id: 'pipe_leakage',   label: 'Pipe Leakage',               icon: 'build-outline',                     color: '#FF3B30' },
];

// ─── Legacy-to-UI category mapping ────────────────────────────────────────────

/**
 * Maps a legacy categoryId → UI filter category id.
 * Unknown / unmapped ids fall through to 'other'.
 */
const LEGACY_ID_MAP = {
  // Legacy form ids
  waterlogging:       'urban_flooding',
  drainage_overflow:  'drain_blockage',
  contamination:      'polluted_water',
  pipe_burst:         'pipe_leakage',
  // Already-normalised future values (round-trip safe)
  urban_flooding:     'urban_flooding',
  drain_blockage:     'drain_blockage',
  polluted_water:     'polluted_water',
  overflowing_pond:   'overflowing_pond',
  pipe_leakage:       'pipe_leakage',
  // Legacy ids with no equivalent → Other
  low_pressure:       'other',
  water_wastage:      'other',
  meter_fault:        'other',
  tanker_disruption:  'other',
  other:              'other',
};

/**
 * Keyword fallback: scan categoryLabel when categoryId is not in the map.
 */
function guessFromLabel(label) {
  if (!label || typeof label !== 'string') return null;
  const l = label.toLowerCase();
  if (l.includes('flood') || l.includes('waterlog') || l.includes('street flood')) return 'urban_flooding';
  if (l.includes('pond') || l.includes('lake')) return 'overflowing_pond';
  if (l.includes('drain') || l.includes('sewage') || l.includes('overflow'))        return 'drain_blockage';
  if (l.includes('contaminat') || l.includes('dirty') || l.includes('pollut') || l.includes('stagnant')) return 'polluted_water';
  if (l.includes('pipe') || l.includes('burst') || l.includes('leak'))               return 'pipe_leakage';
  return null;
}

// ─── Public helpers ────────────────────────────────────────────────────────────

/**
 * Returns the UI filter category id for a report.
 * Never throws; always returns a valid string.
 */
export function getUiCategoryId(report) {
  if (!report || typeof report !== 'object') return 'other';
  const rawId = typeof report.categoryId === 'string' ? report.categoryId.trim().toLowerCase() : '';
  if (Object.hasOwn(LEGACY_ID_MAP, rawId)) return LEGACY_ID_MAP[rawId];
  const fromLabel = guessFromLabel(report.categoryLabel);
  if (fromLabel) return fromLabel;
  return 'other';
}

/**
 * Returns the full FILTER_CATEGORIES entry for a report's UI category.
 */
export function getCategoryMeta(report) {
  return getCategoryById(getUiCategoryId(report));
}

/**
 * Returns the FILTER_CATEGORIES entry for a given UI category id.
 * Falls back to a synthesised "Other water issue" entry for unknown ids.
 */
export function getCategoryById(uiId) {
  const found = FILTER_CATEGORIES.find((c) => c.id === uiId);
  if (found) return found;
  return {
    id: uiId || 'other',
    label: 'Other water issue',
    icon: 'ellipsis-horizontal-circle-outline',
    color: '#8E8E93',
  };
}

/**
 * Returns true when a report belongs to the given filter category id.
 * 'all' always returns true.
 */
export function reportMatchesCategory(report, filterCategoryId) {
  if (!filterCategoryId || filterCategoryId === 'all') return true;
  return getUiCategoryId(report) === filterCategoryId;
}

// ─── Status display ────────────────────────────────────────────────────────────

const STATUS_META = {
  reported:    { label: 'Reported',     color: '#FF3B30', bg: '#fff1f0', icon: 'alert-circle-outline'      },
  review:      { label: 'Under Review', color: '#FF9500', bg: '#fff8ed', icon: 'time-outline'              },
  in_progress: { label: 'In Progress',  color: '#007AFF', bg: '#eff6ff', icon: 'construct-outline'         },
  fixed:       { label: 'Resolved',     color: '#34C759', bg: '#eefbf2', icon: 'checkmark-circle-outline'  },
};

/**
 * Returns display metadata for a report status value.
 * Provides neutral fallback for unknown statuses.
 */
export function getStatusMeta(status) {
  if (typeof status === 'string' && Object.hasOwn(STATUS_META, status)) return STATUS_META[status];
  return { label: typeof status === 'string' && status ? status : 'Unknown', color: '#8E8E93', bg: '#f2f2f7', icon: 'help-circle-outline' };
}

// ─── Photo parsing ─────────────────────────────────────────────────────────────

/**
 * Safely parses the photos field from a report into an array of URI strings.
 * Accepts: string[], JSON string array, single URI string, or empty / invalid.
 */
export function parsePhotos(photos) {
  if (!photos) return [];

  if (Array.isArray(photos)) {
    return photos.filter((p) => typeof p === 'string' && p.trim().length > 0);
  }

  if (typeof photos === 'string') {
    const trimmed = photos.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => typeof p === 'string' && p.trim().length > 0);
      }
      if (typeof parsed === 'string' && parsed.trim().length > 0) return [parsed.trim()];
    } catch (_) {
      // Not JSON — treat as a plain URI string
    }
    return [trimmed];
  }

  return [];
}

// ─── Address helper ────────────────────────────────────────────────────────────

/**
 * Returns the best single-line address string from a report.
 * Handles both nested { address: { line1, landmark } } and flat { addressLine1, landmark }.
 */
export function getAddressLine(report) {
  if (!report) return null;
  const addr = report.address;
  if (addr && typeof addr === 'object') return addr.line1 || addr.landmark || null;
  return report.addressLine1 || report.landmark || null;
}

// ─── Date formatting ───────────────────────────────────────────────────────────

/**
 * Formats a createdAt ISO string into a human-readable relative or absolute date.
 * Returns null on any error so callers can show a fallback.
 */
export function formatReportDate(createdAt) {
  if (!createdAt) return null;
  try {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return null;
    const diffMs    = Date.now() - date.getTime();
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);
    if (diffMins  < 1)  return 'Just now';
    if (diffMins  < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays  < 7)  return `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: diffDays > 365 ? 'numeric' : undefined,
    });
  } catch (_) {
    return null;
  }
}
