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

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function formatSupabaseReport(row) {
  if (!row || typeof row !== 'object') return null;
  const coordinates = readCoordinates(row);
  let parsedPhotos = [];
  try {
    parsedPhotos =
      typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos || [];
    if (!Array.isArray(parsedPhotos)) {
      parsedPhotos = typeof parsedPhotos === 'string' && parsedPhotos.trim().length > 0 ? [parsedPhotos.trim()] : [];
    }
  } catch (e) {
    if (typeof row.photos === 'string' && row.photos.trim().length > 0) {
      parsedPhotos = [row.photos.trim()];
    } else {
      parsedPhotos = [];
    }
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

export async function uploadPhotoToSupabase(photoItem, bucket = 'report-photos', client = supabase) {
  if (!photoItem) return null;

  const rawUri = typeof photoItem === 'string' ? photoItem : photoItem.uri;
  const base64Data = typeof photoItem === 'object' ? photoItem.base64 : null;
  const explicitMime = typeof photoItem === 'object' ? photoItem.mimeType : null;

  if (rawUri && (rawUri.startsWith('http://') || rawUri.startsWith('https://'))) {
    return rawUri;
  }

  try {
    const rawClean = rawUri ? rawUri.split('?')[0].split('#')[0] : '';
    let cleanExt = 'jpg';
    let contentType = explicitMime || 'image/jpeg';

    if (rawUri && rawUri.startsWith('data:')) {
      if (!rawUri.startsWith('data:image/')) {
        throw new Error('Only JPG, PNG and WebP images are supported.');
      }
      const match = rawUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);/);
      if (match) {
        const mime = match[1].toLowerCase();
        if (mime === 'image/png' || mime === 'image/x-png') {
          cleanExt = 'png';
          contentType = 'image/png';
        } else if (mime === 'image/webp') {
          cleanExt = 'webp';
          contentType = 'image/webp';
        } else if (mime.startsWith('image/')) {
          cleanExt = 'jpg';
          contentType = 'image/jpeg';
        } else {
          throw new Error('Only JPG, PNG and WebP images are supported.');
        }
      }
    } else if (explicitMime) {
      const mime = explicitMime.toLowerCase();
      if (!mime.startsWith('image/')) {
        throw new Error('Only JPG, PNG and WebP images are supported.');
      }
      if (mime === 'image/png' || mime === 'image/x-png') {
        cleanExt = 'png';
        contentType = 'image/png';
      } else if (mime === 'image/webp') {
        cleanExt = 'webp';
        contentType = 'image/webp';
      } else {
        cleanExt = 'jpg';
        contentType = 'image/jpeg';
      }
    } else if (rawClean && !rawClean.startsWith('blob:') && !rawClean.startsWith('content:')) {
      const lastSegment = rawClean.split('/').pop() || '';
      if (lastSegment.includes('.')) {
        const fileExt = (lastSegment.split('.').pop() || '').toLowerCase();
        const validImages = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'gif', 'bmp', 'tiff', 'jfif'];
        if (validImages.includes(fileExt)) {
          if (fileExt === 'png') {
            cleanExt = 'png';
            contentType = 'image/png';
          } else if (fileExt === 'webp') {
            cleanExt = 'webp';
            contentType = 'image/webp';
          } else {
            cleanExt = 'jpg';
            contentType = 'image/jpeg';
          }
        } else if (fileExt) {
          throw new Error('Only JPG, PNG and WebP images are supported.');
        }
      }
    }

    const fileName = `report_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}.${cleanExt}`;
    const filePath = `${fileName}`;

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

    if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
      throw new Error('Photo must be smaller than 5 MB.');
    }

    const activeClient = client || requireSupabase();
    const { error } = await activeClient.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error('Could not upload photo. Please try again.');
    }

    const { data: publicData } = activeClient.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!publicData?.publicUrl) throw new Error('Photo upload did not return a public URL.');
    return publicData.publicUrl;
  } catch (err) {
    throw err;
  }
}

export async function saveReportToDatabase(reportData, client = supabase) {
  try {
    const activeClient = client || requireSupabase();
    const coordinates = readCoordinates(reportData.coordinates) || readCoordinates(reportData);
    if (!coordinates) throw new Error('A valid report location is required. Enable location and choose the problem pin before submitting.');
    if (
      !Number.isFinite(coordinates.latitude) ||
      !Number.isFinite(coordinates.longitude) ||
      coordinates.latitude < -90 ||
      coordinates.latitude > 90 ||
      coordinates.longitude < -180 ||
      coordinates.longitude > 180
    ) {
      throw new Error('Valid coordinates within standard ranges (-90 to 90, -180 to 180) are required.');
    }
    let uploadedPhotos = [];
    const photoList = Array.isArray(reportData.photos) ? reportData.photos.slice(0, 5) : [];
    if (photoList.length > 0) {
      uploadedPhotos = await Promise.all(
        photoList.map((item) => uploadPhotoToSupabase(item, 'report-photos', activeClient))
      );
    }

    const reportId =
      reportData.id ||
      `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const payload = {
      id: reportId,
      name: (reportData.name || '').trim().slice(0, 120),
      categoryId: reportData.categoryId || 'other',
      categoryLabel: reportData.categoryLabel || reportData.category || 'Other',
      addressLine1:
        (reportData.address?.line1 || reportData.addressLine1 || 'Unknown Street').trim().slice(0, 200),
      addressLine2: (reportData.address?.line2 || reportData.addressLine2 || '').trim().slice(0, 200) || null,
      landmark: (reportData.address?.landmark || reportData.landmark || '').trim().slice(0, 200),
      description: (reportData.description || '').trim().slice(0, 2000),
      photos: JSON.stringify(uploadedPhotos.filter(Boolean)),
      status: reportData.status || 'reported',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      userLatitude:
        reportData.userCoordinates?.latitude !== undefined && Number.isFinite(Number(reportData.userCoordinates.latitude))
          ? parseFloat(reportData.userCoordinates.latitude)
          : reportData.userLatitude !== undefined && Number.isFinite(Number(reportData.userLatitude))
          ? parseFloat(reportData.userLatitude)
          : null,
      userLongitude:
        reportData.userCoordinates?.longitude !== undefined && Number.isFinite(Number(reportData.userCoordinates.longitude))
          ? parseFloat(reportData.userCoordinates.longitude)
          : reportData.userLongitude !== undefined && Number.isFinite(Number(reportData.userLongitude))
          ? parseFloat(reportData.userLongitude)
          : null,
      distanceFromUser: Math.max(0, parseFloat(
        reportData.distanceFromUser ?? reportData.distance ?? 0
      ) || 0),
      waterDepth: reportData.waterDepth || null,
      peopleAffected: reportData.peopleAffected || null,
      roadBlocked: reportData.roadBlocked || null,
      severity: reportData.severity || null,
      createdAt: reportData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await activeClient
      .from('Report')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw error;
    }

    const formatted = formatSupabaseReport(data);
    localReportsCache.unshift(formatted);
    return { success: true, report: formatted };
  } catch (err) {
    return {
      success: false,
      error: readableError(err),
    };
  }
}

export async function addPhotosToReport(reportId, newPhotos) {
  try {
    requireSupabase();
    if (!reportId) throw new Error('Report ID is required.');
    if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
      return { success: true, photos: [] };
    }

    const uploadedUrls = await Promise.all(
      newPhotos.map((item) => uploadPhotoToSupabase(item))
    );
    const validUrls = uploadedUrls.filter(Boolean);
    if (validUrls.length === 0) {
      throw new Error('No valid photos could be uploaded.');
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('Report')
      .select('*')
      .eq('id', String(reportId))
      .single();

    if (fetchErr) {
      throw fetchErr;
    }

    let currentPhotos = [];
    try {
      currentPhotos =
        typeof existing?.photos === 'string'
          ? JSON.parse(existing.photos)
          : existing?.photos || [];
      if (!Array.isArray(currentPhotos)) currentPhotos = [];
    } catch (e) {
      currentPhotos = [];
    }

    const combinedPhotos = [...currentPhotos];
    for (const url of validUrls) {
      if (!combinedPhotos.includes(url)) {
        combinedPhotos.push(url);
      }
    }

    const { data: updatedRow, error: updateErr } = await supabase
      .from('Report')
      .update({
        photos: JSON.stringify(combinedPhotos),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', String(reportId))
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    const formatted = formatSupabaseReport(updatedRow);
    const cacheIndex = localReportsCache.findIndex(
      (r) => String(r.id) === String(reportId)
    );
    if (cacheIndex !== -1) {
      localReportsCache[cacheIndex] = formatted;
    } else {
      localReportsCache.unshift(formatted);
    }

    return { success: true, report: formatted, photos: combinedPhotos };
  } catch (err) {
    return {
      success: false,
      error: readableError(err),
    };
  }
}

export async function getReportsFromDatabase() {
  const snapshot = await getReportsSnapshot();
  if (snapshot.source === 'unavailable') throw new Error(snapshot.error);
  return snapshot.reports;
}

export async function getReportsSnapshot({ signal } = {}) {
  try {
    const client = requireSupabase();
    const reports = [];
    const pageSize = 500;
    const maxPages = 10;
    for (let offset = 0, page = 0; page < maxPages; offset += pageSize, page += 1) {
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
