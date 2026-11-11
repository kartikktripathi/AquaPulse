import { REPORT_LIMIT, findRecentReports } from './spamGuard.js';
import { filterNearbyReports, locateReports } from './nearbyReports.js';

export function spamStep(context) {
  try {
    const reports = context?.reports || [];
    const coords = context?.coords;
    const now = context?.now;
    const recent = findRecentReports(reports, coords, now);
    if (recent.length >= REPORT_LIMIT) {
      return {
        ok: false,
        kind: 'spam',
        message: 'You have sent 5 reports from this spot in the last hour. Try again later.'
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: true };
  }
}

export function duplicateStep(context) {
  try {
    const reports = context?.reports || [];
    const coords = context?.coords;
    const categoryId = context?.categoryId || 'all';
    const { located } = locateReports(reports, coords);
    const filtered = filterNearbyReports(located, {
      radiusMeters: 200,
      categoryId: categoryId,
      includeResolved: false
    });
    if (filtered.length > 0) {
      const matches = filtered.slice(0, 3).map(function (item) {
        return {
          ...item,
          id: item.report.id,
          categoryLabel: item.report.categoryLabel || item.report.category || 'Problem',
          addressLine1: item.report.addressLine1 || 'Unknown location',
          status: item.report.status || 'reported',
          distanceMeters: item.distanceMeters,
          report: item.report
        };
      });
      return {
        ok: false,
        kind: 'duplicate',
        message: 'Similar reports found nearby.',
        matches: matches
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: true };
  }
}

export async function runSubmitChecks(context, steps) {
  if (!Array.isArray(steps)) {
    return { ok: true };
  }
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    try {
      const res = await step(context);
      if (res && res.ok === false) {
        return res;
      }
    } catch (e) {}
  }
  return { ok: true };
}

