/**
 * Calculate the great-circle distance between two geographic coordinates
 * using the Haversine formula (returns distance in meters).
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null
  ) {
    return 0;
  }

  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Reverse geocode a latitude/longitude pair via OpenStreetMap Nominatim.
 * Returns { line1, line2, landmark, displayName }
 */
export async function reverseGeocode(latitude, longitude) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
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
    console.warn('Reverse geocoding error:', error);
    return null;
  }
}

