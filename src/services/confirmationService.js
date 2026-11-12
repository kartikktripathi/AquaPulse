import { supabase } from '../lib/supabase.js';
import { getDeviceId } from '../utils/deviceId.js';
import { reportEvents } from '../utils/reportEvents.js';

function stringToArrayBuffer(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i += 1) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

export async function getConfirmationCount(reportId, client = supabase) {
  try {
    if (!client || !reportId) {
      return null;
    }
    const cleanId = String(reportId).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) {
      return null;
    }
    const { data, error } = await client.storage
      .from('report-photos')
      .list('confirmations/' + cleanId, { limit: 1000 });

    if (error || !Array.isArray(data)) {
      return null;
    }
    return data.filter(function (item) {
      return item && item.name && !item.name.startsWith('.');
    }).length;
  } catch (e) {
    return null;
  }
}

export async function hasUserConfirmed(reportId, client = supabase) {
  try {
    if (!client || !reportId) {
      return false;
    }
    const cleanId = String(reportId).replace(/[^a-zA-Z0-9_-]/g, '');
    const deviceId = await getDeviceId();
    if (!cleanId || !deviceId) {
      return false;
    }
    const { data, error } = await client.storage
      .from('report-photos')
      .list('confirmations/' + cleanId, { limit: 1000 });

    if (error || !Array.isArray(data)) {
      return false;
    }
    return data.some(function (item) {
      return item && item.name === deviceId + '.json';
    });
  } catch (e) {
    return false;
  }
}

export async function confirmReport(reportId, client = supabase) {
  try {
    if (!client) {
      return { success: false, error: 'Database service unavailable' };
    }
    const cleanId = String(reportId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) {
      return { success: false, error: 'Invalid report identifier' };
    }
    const already = await hasUserConfirmed(cleanId, client);
    if (already) {
      const currentCount = await getConfirmationCount(cleanId, client);
      return { success: true, count: currentCount, alreadyConfirmed: true };
    }
    const deviceId = await getDeviceId();
    const filePath = 'confirmations/' + cleanId + '/' + deviceId + '.json';
    const content = JSON.stringify({ at: new Date().toISOString() });
    const buffer = stringToArrayBuffer(content);

    const { error } = await client.storage
      .from('report-photos')
      .upload(filePath, buffer, {
        contentType: 'application/json',
        upsert: true
      });

    if (error) {
      return { success: false, error: 'Could not record confirmation' };
    }

    const newCount = await getConfirmationCount(cleanId, client);
    reportEvents.emit('report:confirmed', { reportId: cleanId, count: newCount });
    return { success: true, count: newCount };
  } catch (e) {
    return { success: false, error: 'Could not record confirmation' };
  }
}
