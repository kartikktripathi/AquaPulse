export function calculateDistanceMeters(lat1, lon1, lat2, lon2, round = true) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2) ||
    lat1 < -90 ||
    lat1 > 90 ||
    lat2 < -90 ||
    lat2 > 90 ||
    lon1 < -180 ||
    lon1 > 180 ||
    lon2 < -180 ||
    lon2 > 180
  ) {
    return 0;
  }

  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const clamped = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
  const meters = R * c;
  return round ? Math.round(meters) : meters;
}

export async function reverseGeocode(latitude, longitude) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AquaPulse-App',
        },
      }
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data || !data.address) {
      return null;
    }

    const addr = data.address;
    const road =
      addr.road ||
      addr.street ||
      addr.pedestrian ||
      addr.path ||
      addr.footway ||
      data.name ||
      '';
    const houseNumber = addr.house_number || '';
    const line1 = houseNumber ? `${houseNumber}, ${road}` : road;

    const suburb = addr.suburb || addr.neighbourhood || addr.residential || '';
    const city =
      addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
    const line2 = [suburb, city].filter(Boolean).join(', ');

    const landmark =
      addr.amenity ||
      addr.building ||
      addr.landmark ||
      addr.shop ||
      addr.tourism ||
      '';

    return {
      line1,
      line2,
      landmark,
      displayName: data.display_name || '',
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

