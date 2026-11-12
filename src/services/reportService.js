import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Determine API candidate URLs depending on current platform (Web, iOS simulator/device, Android emulator).
 */
function getApiCandidates() {
  const candidates = [];

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

/**
 * In-memory fallback cache for reports.
 */
let localReportsCache = [];

/**
 * Save a newly submitted water problem report into the PostgreSQL database.
 */
export async function saveReportToDatabase(reportData) {
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
          localReportsCache.unshift(data.report);
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

  console.warn(
    'Could not connect to PostgreSQL database server, saved to local cache:',
    lastError?.message
  );

  const fallbackReport = {
    ...reportData,
    id: reportData.id || `local_${Date.now()}`,
    createdAt: reportData.createdAt || new Date().toISOString(),
    status: reportData.status || 'reported',
  };

  localReportsCache.unshift(fallbackReport);
  return { success: true, report: fallbackReport, isLocalFallback: true };
}

/**
 * Fetch all reports from the PostgreSQL database.
 */
export async function getReportsFromDatabase() {
  const candidates = getApiCandidates();

  for (const base of candidates) {
    try {
      const endpoint = `${base}/api/reports`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(endpoint, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.success && Array.isArray(data.reports)) {
          localReportsCache = data.reports;
          return data.reports;
        }
      }
    } catch (err) {
      // Try next candidate
    }
  }

  return localReportsCache;
}
