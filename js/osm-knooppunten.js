/**
 * OSM Knooppunten module — fetches knooppunten from OpenStreetMap via the Overpass API.
 * Queries for both cycling (rcn_ref) and walking/hiking (rwn_ref) node-network nodes.
 */

const OsmKnooppunten = (() => {
  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

  /**
   * Compute a bounding box from an array of lat/lon points, with an optional buffer.
   *
   * @param {Array<{lat: number, lon: number}>} points
   * @param {number} [bufferDeg=0.01] - Extra padding in degrees (~1 km)
   * @returns {{ south: number, west: number, north: number, east: number }}
   */
  function computeBounds(points, bufferDeg = 0.01) {
    if (!points || points.length === 0) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }

    return {
      south: minLat - bufferDeg,
      west:  minLon - bufferDeg,
      north: maxLat + bufferDeg,
      east:  maxLon + bufferDeg,
    };
  }

  /**
   * Build the Overpass QL query for rcn_ref and rwn_ref nodes within a bounding box.
   *
   * @param {{ south: number, west: number, north: number, east: number }} bounds
   * @returns {string}
   */
  function buildQuery(bounds) {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    return `[out:json][timeout:25];
(
  node["rcn_ref"](${bbox});
  node["rwn_ref"](${bbox});
);
out body;`;
  }

  /**
   * Parse a raw Overpass JSON response into knooppunt objects.
   * Only nodes whose ref is a 1–2 digit number are included.
   *
   * @param {object} data - Parsed JSON from the Overpass API
   * @returns {Array<{ lat: number, lon: number, name: string, isKnooppunt: boolean, osmId: number, networkType: string }>}
   */
  function parseOverpassResponse(data) {
    if (!data || !Array.isArray(data.elements)) return [];

    return data.elements
      .map((el) => {
        const name = (el.tags && (el.tags.rcn_ref || el.tags.rwn_ref)) || '';
        const networkType = (el.tags && el.tags.rcn_ref) ? 'rcn' : 'rwn';
        return {
          lat: el.lat,
          lon: el.lon,
          name,
          isKnooppunt: true,
          osmId: el.id,
          networkType,
        };
      })
      .filter((k) => /^\d{1,2}$/.test(k.name.trim()));
  }

  /**
   * Fetch knooppunten from OpenStreetMap for the bounding box of the given GPX data.
   *
   * @param {{ trackPoints: Array, routePoints: Array, knooppunten: Array }} gpxData
   * @returns {Promise<Array>}
   */
  async function fetchForRoute(gpxData) {
    const allPoints = [
      ...(gpxData.trackPoints  || []),
      ...(gpxData.routePoints  || []),
      ...(gpxData.knooppunten  || []),
    ];

    if (allPoints.length === 0) {
      throw new Error('Geen routepunten beschikbaar om op te zoeken.');
    }

    const bounds = computeBounds(allPoints);
    const query = buildQuery(bounds);

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      throw new Error(`Overpass API fout: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return parseOverpassResponse(data);
  }

  return { fetchForRoute, computeBounds, buildQuery, parseOverpassResponse };
})();

// Export for Node.js/Jest (tests) while keeping global for browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OsmKnooppunten };
}
