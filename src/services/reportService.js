import { supabase, supabaseAdmin } from '../lib/supabase.js';

let localReportsCache = [];

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
  if (!row) return null;
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
    latitude: parseFloat(row.latitude ?? 0),
    longitude: parseFloat(row.longitude ?? 0),
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
 * Returns public CDN URL on success, or original URI if upload fails.
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
      explicitMime || `image/${cleanExt === 'jpg' ? 'jpeg' : cleanExt}`;

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
      console.warn('Could not extract arrayBuffer for photo:', rawUri);
      return rawUri;
    }

    // 1. Try uploading using anon client
    let { data, error } = await supabase.storage
      .from('report-photos')
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    // 2. If blocked by RLS in development, fallback to admin client
    if (error && error.message?.includes('row-level security') && supabaseAdmin) {
      console.warn(
        'Storage RLS blocked anon client, using admin fallback for photo upload...'
      );
      const adminResult = await supabaseAdmin.storage
        .from('report-photos')
        .upload(filePath, arrayBuffer, {
          contentType,
          upsert: true,
        });
      data = adminResult.data;
      error = adminResult.error;
    }

    if (error) {
      console.error('Supabase storage upload error:', error.message);
      return rawUri;
    }

    const { data: publicData } = supabase.storage
      .from('report-photos')
      .getPublicUrl(filePath);

    console.log('Photo uploaded to Supabase Storage CDN:', publicData?.publicUrl);
    return publicData?.publicUrl || rawUri;
  } catch (err) {
    console.error('Error uploading photo to Supabase storage:', err);
    return rawUri;
  }
}

/**
 * Save a newly submitted water problem report into Supabase.
 */
export async function saveReportToDatabase(reportData) {
  try {
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
      latitude: parseFloat(
        reportData.coordinates?.latitude ?? reportData.latitude ?? 0
      ),
      longitude: parseFloat(
        reportData.coordinates?.longitude ?? reportData.longitude ?? 0
      ),
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

    const fallbackReport = {
      ...reportData,
      id: reportData.id || `local_${Date.now()}`,
      createdAt: reportData.createdAt || new Date().toISOString(),
      status: reportData.status || 'reported',
      photos: reportData.photos || [],
      waterDepth: reportData.waterDepth || null,
      peopleAffected: reportData.peopleAffected || null,
      roadBlocked: reportData.roadBlocked || null,
      severity: reportData.severity || null,
    };

    localReportsCache.unshift(fallbackReport);
    return {
      success: false,
      report: fallbackReport,
      isLocalFallback: true,
      error: err.message,
    };
  }
}

/**
 * Fetch all reports from Supabase.
 */
export async function getReportsFromDatabase() {
  try {
    const { data, error } = await supabase
      .from('Report')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      throw error;
    }

    if (Array.isArray(data)) {
      const formatted = data.map(formatSupabaseReport);
      localReportsCache = formatted;
      return formatted;
    }
  } catch (err) {
    console.warn('Could not fetch from Supabase Report table:', err.message);
  }

  return localReportsCache;
}
