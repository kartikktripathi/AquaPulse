import AsyncStorage from '@react-native-async-storage/async-storage';

let cachedDeviceId = null;
let initPromise = null;

export function sanitizeDeviceId(raw) {
  if (!raw || typeof raw !== 'string') {
    return 'unknown-device';
  }
  const safe = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
  if (!safe) {
    return 'unknown-device';
  }
  return safe.slice(0, 60);
}

function generateRandomId() {
  const r1 = Math.random().toString(36).substring(2, 10);
  const r2 = Math.random().toString(36).substring(2, 10);
  const t = Date.now().toString(36);
  return 'dev-' + r1 + r2 + t;
}

export async function loadDeviceId(storage = AsyncStorage) {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  try {
    if (storage && typeof storage.getItem === 'function') {
      const stored = await storage.getItem('aquapulse_device_id');
      if (stored && typeof stored === 'string') {
        const clean = sanitizeDeviceId(stored);
        if (clean && clean.startsWith('dev-')) {
          cachedDeviceId = clean;
          return cachedDeviceId;
        }
      }
    }
  } catch (e) {}

  const generated = generateRandomId();
  try {
    if (storage && typeof storage.setItem === 'function') {
      await storage.setItem('aquapulse_device_id', generated);
    }
  } catch (e) {}

  cachedDeviceId = sanitizeDeviceId(generated);
  return cachedDeviceId;
}

export async function getDeviceId(storage = AsyncStorage) {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  if (!initPromise) {
    initPromise = loadDeviceId(storage);
  }
  const id = await initPromise;
  initPromise = null;
  return id;
}

export function resetDeviceIdCacheForTesting() {
  cachedDeviceId = null;
  initPromise = null;
}

export default getDeviceId;
