import { calculateDistanceMeters } from './geo.js';

export const REPORT_LIMIT = 5;

export function findRecentReports(reports, coords, now) {
  if (!Array.isArray(reports) || !coords) {
    return [];
  }
  const cLat = Number(coords.latitude !== undefined ? coords.latitude : coords.lat);
  const cLon = Number(coords.longitude !== undefined ? coords.longitude : coords.lon);
  if (!Number.isFinite(cLat) || !Number.isFinite(cLon)) {
    return [];
  }
  const currentTime = now ? new Date(now).getTime() : Date.now();
  if (!Number.isFinite(currentTime)) {
    return [];
  }
  const oneHourMs = 60 * 60 * 1000;

  return reports.filter(function (report) {
    if (!report) {
      return false;
    }
    const createdAt = report.createdAt ? new Date(report.createdAt).getTime() : 0;
    if (!Number.isFinite(createdAt)) {
      return false;
    }
    const age = currentTime - createdAt;
    if (age < 0 || age > oneHourMs) {
      return false;
    }
    const rLat = Number(
      report.userLatitude !== undefined && report.userLatitude !== null
        ? report.userLatitude
        : report.latitude
    );
    const rLon = Number(
      report.userLongitude !== undefined && report.userLongitude !== null
        ? report.userLongitude
        : report.longitude
    );
    if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) {
      return false;
    }
    const dist = calculateDistanceMeters(cLat, cLon, rLat, rLon, false);
    return dist <= 100;
  });
}

