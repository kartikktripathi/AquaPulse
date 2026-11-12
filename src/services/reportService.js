import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { readLocalReports, writeLocalReport } from './localReportStorage';

// Local demo is the default until the team supplies its backend.
export const isLocalDemoMode = process.env.EXPO_PUBLIC_REPORT_MODE !== 'api';

/**
 * Determine API candidate URLs depending on current platform (Web, iOS simulator/device, Android emulator).
 */
function getApiCandidates() {
  const candidates = [];
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (configuredUrl) return [configuredUrl];

  if (Platform.OS === 'web') {
    candidates.push('http://localhost:5001');
    candidates.push(''); // relative /api/reports fallback
  } else {
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri ? hostUri.split(':')[0] : 'localhost';

    candidates.push(`http://${host}:5001`);
    candidates.push(`http://${host}:8081`);

    if (Platform.OS === 'android') {
      candidates.push('http://10.0.2.2:5001');
      candidates.push('http://10.0.2.2:8081');
    } else {
      candidates.push('http://localhost:5001');
      candidates.push('http://localhost:8081');
    }
  }

  // Remove duplicates
  return Array.from(new Set(candidates));
}

let localReportsCache = [];
let reportsFetchedAt = null;

/**
 * Save a newly submitted water problem report into the PostgreSQL database.
 */
export async function saveReportToDatabase(reportData) {
  if (isLocalDemoMode) {
    const report = {
      ...reportData,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      status: 'reported',
      createdAt: new Date().toISOString(),
    };
    try {
      await writeLocalReport(report);
      return { success: true, report, source: 'local' };
    } catch (error) {
      return { success: false, error: error.message || 'Could not save this report on your device. Please try again.' };
    }
  }
  const candidates = getApiCandidates();
  let lastError = null;

  for (const base of candidates) {
    try {
      const endpoint = `${base}/api/reports`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.success && data.report) {
          console.log(
            'Report successfully saved to PostgreSQL database via',
            endpoint
          );
          return { success: true, report: data.report };
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  return {
    success: false,
    error:
      !lastError || lastError.message === 'Failed to fetch'
        ? 'Submission failed due to a network error. Tap Try again.'
        : lastError.message,
  };
}

/**
 * Fetch all reports from the PostgreSQL database.
 */
export async function getReportsFromDatabase() {
  const snapshot = await getReportsSnapshot();
  return snapshot.reports;
}

/** Preserve source information so nearby browsing can distinguish offline from empty. */
export async function getReportsSnapshot({ signal } = {}) {
  if (isLocalDemoMode) {
    const reports = await readLocalReports();
    if (!Array.isArray(reports) || reports.some((report) => !report || typeof report !== 'object')) {
      throw new Error('Saved reports could not be read.');
    }
    return {
      reports: reports.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)),
      source: 'local',
      fetchedAt: new Date().toISOString(),
    };
  }
  const candidates = getApiCandidates();

  for (const base of candidates) {
    if (signal?.aborted) break;
    const controller = new AbortController();
    const abortRequest = () => controller.abort();
    signal?.addEventListener('abort', abortRequest, { once: true });
    const timeoutId = setTimeout(abortRequest, 4000);
    try {
      const endpoint = `${base}/api/reports`;
      const response = await fetch(endpoint, {
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.success && Array.isArray(data.reports)) {
          if (signal?.aborted) break;
          localReportsCache = data.reports;
          reportsFetchedAt = new Date().toISOString();
          return { reports: data.reports, source: 'network', fetchedAt: reportsFetchedAt };
        }
      }
    } catch {
      // Try next candidate
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortRequest);
    }
  }

  return {
    reports: localReportsCache,
    source: reportsFetchedAt ? 'cache' : 'unavailable',
    fetchedAt: reportsFetchedAt,
  };
}
