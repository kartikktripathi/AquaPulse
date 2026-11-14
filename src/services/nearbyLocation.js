import * as Location from 'expo-location';
import { readCoordinates } from '../utils/nearbyReports.js';

function locationError(code, message, canAskAgain = true) {
  return Object.assign(new Error(message), { code, canAskAgain });
}

export async function getNearbyLocation({ signal } = {}) {
  let timeoutId;
  let abortRequest;
  let finished = false;
  const checkActive = () => {
    if (finished || signal?.aborted) throw locationError('cancelled', 'Location request cancelled.');
  };
  const interrupted = new Promise((_, reject) => {
    abortRequest = () => reject(locationError('cancelled', 'Location request cancelled.'));
    if (signal?.aborted) abortRequest();
    else signal?.addEventListener('abort', abortRequest, { once: true });
    timeoutId = setTimeout(() => reject(locationError(
      'timeout', 'Finding your location took too long. Move to an open area and try again.'
    )), 10000);
  });

  const locate = async () => {
    let permission = await Location.getForegroundPermissionsAsync();
    checkActive();
    if (permission.status !== 'granted' && permission.canAskAgain !== false) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== 'granted') {
      throw locationError('permission', 'Allow location access to find water issues near you.', permission.canAskAgain);
    }
    checkActive();
    if (!await Location.hasServicesEnabledAsync()) {
      throw locationError('services', 'Location services are off. Turn on device location and try again.');
    }
    checkActive();
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      maximumAge: 0,
      timeout: 10000,
    });
    const coordinates = readCoordinates(position?.coords);
    if (!coordinates) throw locationError('unavailable', 'Your device did not return a usable location. Please try again.');
    return {
      ...coordinates,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    };
  };

  try {
    if (signal?.aborted) return await interrupted;
    return await Promise.race([locate(), interrupted]);
  } finally {
    finished = true;
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortRequest);
  }
}
