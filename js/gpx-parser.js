/**
 * GPX file parser.
 * Extracts knooppunten (numbered waypoints) and track/route paths from GPX XML.
 */

/**
 * Parse a GPX XML string and return knooppunten, trackPoints, and routePoints.
 *
 * @param {string} xmlString - Raw GPX XML content
 * @returns {{ knooppunten: Array, trackPoints: Array, routePoints: Array }}
 */
function parseGPX(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'application/xml');

  const parseError = xml.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid GPX file: ' + parseError.textContent);
  }

  const knooppunten = [];
  const trackPoints = [];
  const routePoints = [];

  // Parse waypoints — these are the primary source of knooppunten
  xml.querySelectorAll('wpt').forEach((wpt) => {
    const name = wpt.querySelector('name')?.textContent?.trim() || '';
    knooppunten.push({
      lat: parseFloat(wpt.getAttribute('lat')),
      lon: parseFloat(wpt.getAttribute('lon')),
      name,
      isKnooppunt: isKnooppuntName(name),
    });
  });

  // Parse route points (rtept) — may also carry knooppunt names
  xml.querySelectorAll('rtept').forEach((rtept) => {
    const name = rtept.querySelector('name')?.textContent?.trim() || '';
    const point = {
      lat: parseFloat(rtept.getAttribute('lat')),
      lon: parseFloat(rtept.getAttribute('lon')),
      name,
      isKnooppunt: isKnooppuntName(name),
    };
    routePoints.push(point);
    // If this route point is a knooppunt and not already in the list, add it
    if (point.isKnooppunt && !knooppunten.some((k) => k.name === name)) {
      knooppunten.push({ ...point });
    }
  });

  // Parse track points (trkpt) — these define the drawn path, no names
  xml.querySelectorAll('trkpt').forEach((trkpt) => {
    trackPoints.push({
      lat: parseFloat(trkpt.getAttribute('lat')),
      lon: parseFloat(trkpt.getAttribute('lon')),
      ele: parseFloat(trkpt.querySelector('ele')?.textContent || '0'),
    });
  });

  return { knooppunten, trackPoints, routePoints };
}

/**
 * Returns true if the given name looks like a knooppunt number (1–99).
 *
 * @param {string} name
 * @returns {boolean}
 */
function isKnooppuntName(name) {
  return /^\d{1,2}$/.test(name.trim());
}

/**
 * Calculate the distance in metres between two lat/lon coordinates using the
 * Haversine formula.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in metres
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the knooppunt nearest to the given position.
 *
 * @param {{ lat: number, lon: number }} position
 * @param {Array<{ lat: number, lon: number, name: string }>} knooppunten
 * @returns {{ knooppunt: object, distance: number } | null}
 */
function findNearestKnooppunt(position, knooppunten) {
  if (!knooppunten || knooppunten.length === 0) return null;

  let nearest = null;
  let minDistance = Infinity;

  for (const k of knooppunten) {
    const d = haversineDistance(position.lat, position.lon, k.lat, k.lon);
    if (d < minDistance) {
      minDistance = d;
      nearest = k;
    }
  }

  return { knooppunt: nearest, distance: minDistance };
}

/**
 * Format a distance in metres for display.
 *
 * @param {number} metres
 * @returns {string}
 */
function formatDistance(metres) {
  if (metres < 1000) {
    return Math.round(metres) + ' m';
  }
  return (metres / 1000).toFixed(1) + ' km';
}

// Export for Node.js/Jest (tests) while keeping global for browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseGPX, isKnooppuntName, haversineDistance, findNearestKnooppunt, formatDistance };
}
