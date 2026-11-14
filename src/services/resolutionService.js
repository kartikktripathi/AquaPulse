import { supabase } from '../lib/supabase.js';
import { uploadPhotoToSupabase, formatSupabaseReport } from './reportService.js';
import { reportEvents } from '../utils/reportEvents.js';
import { calculateDistanceMeters } from '../utils/geo.js';

export async function resolveReportWithProof(report, photoItem, userCoordsOrClient = null, maybeClient = null) {
  try {
    let userCoords = null;
    let client = supabase;
    if (userCoordsOrClient && typeof userCoordsOrClient.from === 'function') {
      client = userCoordsOrClient;
    } else {
      userCoords = userCoordsOrClient;
      if (maybeClient && typeof maybeClient.from === 'function') {
        client = maybeClient;
      }
    }

    if (!client) {
      return { success: false, error: 'Database service unavailable' };
    }
    const rawId = report && typeof report === 'object' ? report.id : report;
    const cleanId = String(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) {
      return { success: false, error: 'Invalid report' };
    }
    if (!photoItem) {
      return { success: false, error: 'An after photo is required to resolve this report' };
    }

    const { data: currentRow, error: readError } = await client
      .from('Report')
      .select('*')
      .eq('id', cleanId)
      .single();

    if (readError || !currentRow) {
      return { success: false, error: 'Report not found' };
    }

    if (currentRow.status === 'fixed') {
      return { success: false, error: 'This issue has already been marked as fixed.' };
    }

    if (!userCoords || userCoords.latitude === undefined || userCoords.longitude === undefined) {
      return { success: false, error: 'User location is required to verify proximity.' };
    }

    if (currentRow.latitude !== undefined && currentRow.longitude !== undefined) {
      const dist = calculateDistanceMeters(
        userCoords.latitude,
        userCoords.longitude,
        currentRow.latitude,
        currentRow.longitude
      );
      if (dist > 500) {
        return { success: false, error: 'You must be within 500m of the problem to mark it as fixed' };
      }
    }

    let uploadedUrl = null;
    if (typeof photoItem === 'string' && photoItem.startsWith('http')) {
      uploadedUrl = photoItem;
    } else {
      uploadedUrl = await uploadPhotoToSupabase(photoItem, 'report-photos', client);
    }

    if (!uploadedUrl) {
      return { success: false, error: 'Photo upload failed' };
    }

    const taggedUrl = uploadedUrl.endsWith('#after') ? uploadedUrl : uploadedUrl + '#after';

    let existingPhotos = [];
    try {
      existingPhotos = typeof currentRow.photos === 'string'
        ? JSON.parse(currentRow.photos)
        : currentRow.photos || [];
    } catch (e) {
      existingPhotos = [];
    }
    if (!Array.isArray(existingPhotos)) {
      existingPhotos = existingPhotos ? [existingPhotos] : [];
    }

    const updatedPhotos = existingPhotos.concat(taggedUrl);
    const nowIso = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await client
      .from('Report')
      .update({
        photos: JSON.stringify(updatedPhotos),
        status: 'fixed',
        updatedAt: nowIso
      })
      .eq('id', cleanId)
      .select()
      .single();

    if (updateError || !updatedRow) {
      return { success: false, error: 'Could not update report' };
    }

    const formatted = formatSupabaseReport(updatedRow);
    reportEvents.emit('report:resolved', formatted);
    return { success: true, report: formatted };
  } catch (e) {
    return { success: false, error: e?.message || 'Could not resolve report' };
  }
}
