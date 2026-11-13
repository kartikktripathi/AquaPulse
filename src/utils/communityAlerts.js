import { getUiCategoryId } from './categoryMeta.js';
import { createReportFilters, filterReports, normalizeReportStatus } from './reportFilters.js';
import { searchAndSortReports } from './reportListing.js';

export const ALERT_MODES = [{ id: 'all', label: 'All open' }, { id: 'urgent', label: 'High severity' }, { id: 'supply', label: 'Supply-related' }];

export function getCommunityAlerts(reports, { mode = 'all', area = '' } = {}) {
  const open = (Array.isArray(reports) ? reports : []).filter((report) => {
    if (!report || !['reported', 'review', 'in_progress'].includes(normalizeReportStatus(report.status))) return false;
    if (mode === 'urgent') return typeof report.severity === 'string' && report.severity.trim().toLowerCase() === 'high';
    if (mode === 'supply') return getUiCategoryId(report) === 'pipe_leakage' || ['low_pressure', 'tanker_disruption'].includes(report.categoryId);
    return true;
  });
  return searchAndSortReports(filterReports(open, { ...createReportFilters(), area }), '', 'severity');
}
