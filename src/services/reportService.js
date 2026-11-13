import { supabase } from '../lib/supabase.js';
import { readCoordinates } from '../utils/nearbyReports.js';

let localReportsCache = [];
let reportsFetchedAt = null;

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, then restart Expo.');
  return supabase;
}

function readableError(error) {
  const message = error?.message || 'The report service could not complete this request.';
  if (/abort|cancel|fetch failed|failed to fetch|network request failed/i.test(message)) {
    return 'Could not reach Supabase. Check your internet connection and try again.';
  }
  return message;
}

/**
 * Convert base64 string to ArrayBuffer for reliable binary uploads across platforms.
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Format a Supabase Report row into standard app report object.
 */
export function formatSupabaseReport(row) {
  if (!row || typeof row !== 'object') return null;
  const coordinates = readCoordinates(row);
  let parsedPhotos = [];
  try {
    parsedPhotos =
      typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos || [];
  } catch (e) {
    parsedPhotos = [];
  }

  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryLabel: row.categoryLabel,
    addressLine1: row.addressLine1 || '',
    addressLine2: row.addressLine2 || '',
    landmark: row.landmark || '',
    description: row.description || '',
    photos: Array.isArray(parsedPhotos) ? parsedPhotos : [],
    status: row.status || 'reported',
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    userLatitude:
      row.userLatitude !== null && row.userLatitude !== undefined
        ? parseFloat(row.userLatitude)
        : null,
    userLongitude:
      row.userLongitude !== null && row.userLongitude !== undefined
        ? parseFloat(row.userLongitude)
        : null,
    distanceFromUser: parseFloat(row.distanceFromUser ?? 0),
    waterDepth: row.waterDepth || null,
    peopleAffected: row.peopleAffected || null,
    roadBlocked: row.roadBlocked || null,
    severity: row.severity || null,
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

/**
 * Upload a photo (local file://, blob:, data URI, or object { uri, base64 }) to Supabase Storage bucket 'report-photos'.
 * Returns a public CDN URL. Upload failures stop submission so local-only photos
 * are never advertised as shared report evidence.
 */
export async function uploadPhotoToSupabase(photoItem) {
  if (!photoItem) return null;

  const rawUri = typeof photoItem === 'string' ? photoItem : photoItem.uri;
  const base64Data = typeof photoItem === 'object' ? photoItem.base64 : null;
  const explicitMime = typeof photoItem === 'object' ? photoItem.mimeType : null;

  // If already remote HTTP/HTTPS URL, return as-is
  if (rawUri && (rawUri.startsWith('http://') || rawUri.startsWith('https://'))) {
    return rawUri;
  }

  try {
    const ext = rawUri ? rawUri.split('.').pop()?.split('?')[0] : 'jpg';
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(
      ext?.toLowerCase()
    )
      ? ext.toLowerCase()
      : 'jpg';

    const fileName = `report_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}.${cleanExt}`;
    const filePath = `${fileName}`;
    const contentType =
      explicitMime || rawUri?.match(/^data:(image\/[^;]+);base64,/)?.[1] || `image/${cleanExt === 'jpg' ? 'jpeg' : cleanExt}`;

    let arrayBuffer = null;

    if (base64Data) {
      arrayBuffer = base64ToArrayBuffer(base64Data);
    } else if (rawUri && rawUri.startsWith('data:image/')) {
      const base64Part = rawUri.split(',')[1];
      if (base64Part) {
        arrayBuffer = base64ToArrayBuffer(base64Part);
      }
    } else if (rawUri) {
      const res = await fetch(rawUri);
      if (typeof res.arrayBuffer === 'function') {
        arrayBuffer = await res.arrayBuffer();
      } else if (typeof res.blob === 'function') {
        const blob = await res.blob();
        arrayBuffer = await new Response(blob).arrayBuffer();
      }
    }

    if (!arrayBuffer) {
      throw new Error('This photo could not be read. Please choose it again.');
    }

    // 1. Try uploading using anon client
    const { error } = await requireSupabase().storage
      .from('report-photos')
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Photo upload failed: ${readableError(error)}`);
    }

    const { data: publicData } = supabase.storage
      .from('report-photos')
      .getPublicUrl(filePath);

    console.log('Photo uploaded to Supabase Storage CDN:', publicData?.publicUrl);
    if (!publicData?.publicUrl) throw new Error('Photo upload did not return a public URL.');
    return publicData.publicUrl;
  } catch (err) {
    console.error('Error uploading photo to Supabase storage:', err);
    throw err;
  }
}

/**
 * Save a newly submitted water problem report into Supabase.
 */
export async function saveReportToDatabase(reportData) {
  try {
    requireSupabase();
    const coordinates = readCoordinates(reportData.coordinates) || readCoordinates(reportData);
    if (!coordinates) throw new Error('A valid report location is required. Enable location and choose the problem pin before submitting.');
    // 1. Upload any local photos to Supabase Storage
    let uploadedPhotos = [];
    if (Array.isArray(reportData.photos) && reportData.photos.length > 0) {
      console.log(`Uploading ${reportData.photos.length} photo(s) to Supabase Storage...`);
      uploadedPhotos = await Promise.all(
        reportData.photos.map((item) => uploadPhotoToSupabase(item))
      );
    }

    const reportId =
      reportData.id ||
      `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 2. Prepare payload matching Supabase 'Report' table schema
    const payload = {
      id: reportId,
      name: (reportData.name || '').trim(),
      categoryId: reportData.categoryId || 'other',
      categoryLabel: reportData.categoryLabel || reportData.category || 'Other',
      addressLine1:
        reportData.address?.line1 || reportData.addressLine1 || 'Unknown Street',
      addressLine2: reportData.address?.line2 || reportData.addressLine2 || null,
      landmark: reportData.address?.landmark || reportData.landmark || '',
      description: reportData.description || '',
      photos: JSON.stringify(uploadedPhotos),
      status: reportData.status || 'reported',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      userLatitude:
        reportData.userCoordinates?.latitude !== undefined
          ? parseFloat(reportData.userCoordinates.latitude)
          : reportData.userLatitude !== undefined
          ? parseFloat(reportData.userLatitude)
          : null,
      userLongitude:
        reportData.userCoordinates?.longitude !== undefined
          ? parseFloat(reportData.userCoordinates.longitude)
          : reportData.userLongitude !== undefined
          ? parseFloat(reportData.userLongitude)
          : null,
      distanceFromUser: parseFloat(
        reportData.distanceFromUser ?? reportData.distance ?? 0
      ),
      waterDepth: reportData.waterDepth || null,
      peopleAffected: reportData.peopleAffected || null,
      roadBlocked: reportData.roadBlocked || null,
      severity: reportData.severity || null,
      createdAt: reportData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Direct insert into Supabase 'Report' table
    const { data, error } = await supabase
      .from('Report')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw error;
    }

    const formatted = formatSupabaseReport(data);
    localReportsCache.unshift(formatted);
    console.log('Report successfully saved to Supabase Report table! ID:', formatted.id);
    return { success: true, report: formatted };
  } catch (err) {
    console.error(
      'Could not write to Supabase Report table:',
      err.message
    );

    return {
      success: false,
      error: readableError(err),
    };
  }
}

/**
 * Fetch all reports from Supabase.
 */
export async function getReportsFromDatabase() {
  const snapshot = await getReportsSnapshot();
  if (snapshot.source === 'unavailable') throw new Error(snapshot.error);
  return snapshot.reports;
}

/** Page through shared reports so nearby filtering is not limited to the first page. */
export async function getReportsSnapshot({ signal } = {}) {
  try {
    const client = requireSupabase();
    const reports = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      if (signal?.aborted) throw new Error('Request cancelled.');
      let query = client.from('Report').select('*')
        .order('createdAt', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Supabase returned an invalid report list.');
      reports.push(...data.map(formatSupabaseReport).filter(Boolean));
      if (data.length < pageSize) break;
    }
    if (signal?.aborted) throw new Error('Request cancelled.');
    localReportsCache = reports;
    reportsFetchedAt = new Date().toISOString();
    return { reports, source: 'network', fetchedAt: reportsFetchedAt };
  } catch (err) {
    return {
      reports: localReportsCache,
      source: reportsFetchedAt || localReportsCache.length ? 'cache' : 'unavailable',
      fetchedAt: reportsFetchedAt,
      error: readableError(err),
    };
  }
}
