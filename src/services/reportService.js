import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Determine base API URL depending on current platform (Web, iOS simulator/device, Android emulator).
 */
function getApiBaseUrl() {
  if (Platform.OS === 'web') {
    return '';
  }

  // Mobile development server host resolution
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8081`;
  }

  return 'http://localhost:8081';
}

/**
 * In-memory fallback cache for reports.
 */
let localReportsCache = [];

/**
 * Save a newly submitted water problem report into the Prisma database.
 */
export async function saveReportToDatabase(reportData) {
  try {
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/api/reports`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && data.report) {
        localReportsCache.unshift(data.report);
        return { success: true, report: data.report };
      }
    }

    throw new Error(`API responded with status ${response.status}`);
  } catch (error) {
    console.warn(
      'Could not reach /api/reports API endpoint, saving to local fallback cache:',
      error.message
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
}

/**
 * Fetch all reports from the Prisma database.
 */
export async function getReportsFromDatabase() {
  try {
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/api/reports`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(endpoint, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && Array.isArray(data.reports)) {
        localReportsCache = data.reports;
        return data.reports;
      }
    }
  } catch (error) {
    console.warn(
      'Failed to fetch reports from API endpoint, returning cached reports:',
      error.message
    );
  }

  return localReportsCache;
}

