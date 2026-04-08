'use strict';

const { OsmKnooppunten } = require('../js/osm-knooppunten');

// ── computeBounds ─────────────────────────────────────────────────────────────

describe('OsmKnooppunten.computeBounds', () => {
  test('returns null for empty array', () => {
    expect(OsmKnooppunten.computeBounds([])).toBeNull();
  });

  test('returns null for null/undefined input', () => {
    expect(OsmKnooppunten.computeBounds(null)).toBeNull();
    expect(OsmKnooppunten.computeBounds(undefined)).toBeNull();
  });

  test('computes correct bounds for a single point (with default buffer)', () => {
    const bounds = OsmKnooppunten.computeBounds([{ lat: 52.0, lon: 5.0 }]);
    expect(bounds.south).toBeCloseTo(51.99);
    expect(bounds.north).toBeCloseTo(52.01);
    expect(bounds.west).toBeCloseTo(4.99);
    expect(bounds.east).toBeCloseTo(5.01);
  });

  test('computes correct bounds for multiple points', () => {
    const points = [
      { lat: 51.5, lon: 5.0 },
      { lat: 52.5, lon: 6.0 },
      { lat: 52.0, lon: 5.5 },
    ];
    const bounds = OsmKnooppunten.computeBounds(points);
    expect(bounds.south).toBeCloseTo(51.49);
    expect(bounds.north).toBeCloseTo(52.51);
    expect(bounds.west).toBeCloseTo(4.99);
    expect(bounds.east).toBeCloseTo(6.01);
  });

  test('respects custom buffer size', () => {
    const bounds = OsmKnooppunten.computeBounds([{ lat: 52.0, lon: 5.0 }], 0.05);
    expect(bounds.south).toBeCloseTo(51.95);
    expect(bounds.north).toBeCloseTo(52.05);
    expect(bounds.west).toBeCloseTo(4.95);
    expect(bounds.east).toBeCloseTo(5.05);
  });
});

// ── buildQuery ────────────────────────────────────────────────────────────────

describe('OsmKnooppunten.buildQuery', () => {
  test('includes rcn_ref and rwn_ref in the query', () => {
    const bounds = { south: 51.49, west: 4.99, north: 52.51, east: 6.01 };
    const query = OsmKnooppunten.buildQuery(bounds);
    expect(query).toContain('rcn_ref');
    expect(query).toContain('rwn_ref');
  });

  test('includes the bounding box coordinates', () => {
    const bounds = { south: 51.49, west: 4.99, north: 52.51, east: 6.01 };
    const query = OsmKnooppunten.buildQuery(bounds);
    expect(query).toContain('51.49');
    expect(query).toContain('4.99');
    expect(query).toContain('52.51');
    expect(query).toContain('6.01');
  });

  test('requests JSON output', () => {
    const bounds = { south: 51.5, west: 5.0, north: 52.5, east: 6.0 };
    const query = OsmKnooppunten.buildQuery(bounds);
    expect(query).toContain('[out:json]');
  });
});

// ── parseOverpassResponse ─────────────────────────────────────────────────────

describe('OsmKnooppunten.parseOverpassResponse', () => {
  test('returns empty array for null/undefined input', () => {
    expect(OsmKnooppunten.parseOverpassResponse(null)).toEqual([]);
    expect(OsmKnooppunten.parseOverpassResponse(undefined)).toEqual([]);
  });

  test('returns empty array when elements is missing', () => {
    expect(OsmKnooppunten.parseOverpassResponse({})).toEqual([]);
  });

  test('parses cycling (rcn_ref) knooppunten', () => {
    const data = {
      elements: [
        { id: 1, lat: 52.0, lon: 5.0, tags: { rcn_ref: '42' } },
      ],
    };
    const result = OsmKnooppunten.parseOverpassResponse(data);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('42');
    expect(result[0].networkType).toBe('rcn');
    expect(result[0].isKnooppunt).toBe(true);
    expect(result[0].lat).toBe(52.0);
    expect(result[0].lon).toBe(5.0);
    expect(result[0].osmId).toBe(1);
  });

  test('parses walking (rwn_ref) knooppunten', () => {
    const data = {
      elements: [
        { id: 2, lat: 51.5, lon: 4.9, tags: { rwn_ref: '7' } },
      ],
    };
    const result = OsmKnooppunten.parseOverpassResponse(data);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('7');
    expect(result[0].networkType).toBe('rwn');
  });

  test('filters out nodes whose ref is not a 1-2 digit number', () => {
    const data = {
      elements: [
        { id: 1, lat: 52.0, lon: 5.0, tags: { rcn_ref: '42' } },   // valid
        { id: 2, lat: 52.1, lon: 5.1, tags: { rcn_ref: '100' } },  // 3 digits – invalid
        { id: 3, lat: 52.2, lon: 5.2, tags: { rcn_ref: 'A' } },    // non-numeric – invalid
        { id: 4, lat: 52.3, lon: 5.3, tags: { rwn_ref: '5' } },    // valid
      ],
    };
    const result = OsmKnooppunten.parseOverpassResponse(data);
    expect(result).toHaveLength(2);
    expect(result.map((k) => k.name)).toEqual(expect.arrayContaining(['42', '5']));
  });

  test('prefers rcn_ref over rwn_ref when both are present', () => {
    const data = {
      elements: [
        { id: 1, lat: 52.0, lon: 5.0, tags: { rcn_ref: '12', rwn_ref: '34' } },
      ],
    };
    const result = OsmKnooppunten.parseOverpassResponse(data);
    expect(result[0].name).toBe('12');
    expect(result[0].networkType).toBe('rcn');
  });

  test('handles elements with no tags gracefully', () => {
    const data = {
      elements: [
        { id: 1, lat: 52.0, lon: 5.0, tags: {} },
        { id: 2, lat: 52.1, lon: 5.1 },
      ],
    };
    // Both should be filtered out (empty name doesn't match \d{1,2})
    const result = OsmKnooppunten.parseOverpassResponse(data);
    expect(result).toHaveLength(0);
  });
});

// ── fetchForRoute ─────────────────────────────────────────────────────────────

describe('OsmKnooppunten.fetchForRoute', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('throws when gpxData has no points', async () => {
    const gpxData = { trackPoints: [], routePoints: [], knooppunten: [] };
    await expect(OsmKnooppunten.fetchForRoute(gpxData)).rejects.toThrow(
      'Geen routepunten beschikbaar'
    );
  });

  test('calls the Overpass API and returns parsed knooppunten', async () => {
    const mockResponse = {
      elements: [
        { id: 10, lat: 51.5, lon: 5.0, tags: { rcn_ref: '23' } },
        { id: 11, lat: 51.6, lon: 5.1, tags: { rcn_ref: '45' } },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const gpxData = {
      trackPoints: [{ lat: 51.5, lon: 5.0 }, { lat: 51.6, lon: 5.1 }],
      routePoints: [],
      knooppunten: [],
    };

    const result = await OsmKnooppunten.fetchForRoute(gpxData);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://overpass-api.de/api/interpreter',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toHaveLength(2);
    expect(result.map((k) => k.name)).toEqual(expect.arrayContaining(['23', '45']));
  });

  test('throws on non-OK HTTP response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    const gpxData = {
      trackPoints: [{ lat: 51.5, lon: 5.0 }],
      routePoints: [],
      knooppunten: [],
    };

    await expect(OsmKnooppunten.fetchForRoute(gpxData)).rejects.toThrow(
      'Overpass API fout: 429'
    );
  });

  test('uses all available point arrays to compute bounding box', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [] }),
    });

    const gpxData = {
      trackPoints:  [{ lat: 51.5, lon: 5.0 }],
      routePoints:  [{ lat: 52.0, lon: 5.5 }],
      // gpxData.knooppunten contains ALL wpt elements, not just knooppunten;
      // isKnooppunt: false means it is a named waypoint (e.g. "Startpunt"), not a node number.
      knooppunten:  [{ lat: 51.7, lon: 4.8, name: 'X', isKnooppunt: false }],
    };

    await OsmKnooppunten.fetchForRoute(gpxData);

    // The POST body should contain the bounding box derived from all three arrays
    const body = global.fetch.mock.calls[0][1].body;
    const decoded = decodeURIComponent(body.replace(/^data=/, ''));
    // south should be min lat (51.5) minus buffer
    expect(decoded).toContain('51.49');
    // north should be max lat (52.0) plus buffer
    expect(decoded).toContain('52.01');
  });

  test('falls back to second endpoint on 504 (gateway timeout) error', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 504, statusText: 'Gateway Timeout' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [] }) });

    const gpxData = {
      trackPoints: [{ lat: 51.5, lon: 5.0 }],
      routePoints: [],
      knooppunten: [],
    };

    const result = await OsmKnooppunten.fetchForRoute(gpxData);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('https://overpass-api.de/api/interpreter');
    expect(global.fetch.mock.calls[1][0]).toBe('https://overpass.kumi.systems/api/interpreter');
    expect(result).toEqual([]);
  });

  test('throws with last error message when all endpoints fail with 5xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const gpxData = {
      trackPoints: [{ lat: 51.5, lon: 5.0 }],
      routePoints: [],
      knooppunten: [],
    };

    await expect(OsmKnooppunten.fetchForRoute(gpxData)).rejects.toThrow(
      'Overpass API fout: 503'
    );
    // Both endpoints should have been tried
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('does not fall back on 4xx client errors', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });

    const gpxData = {
      trackPoints: [{ lat: 51.5, lon: 5.0 }],
      routePoints: [],
      knooppunten: [],
    };

    await expect(OsmKnooppunten.fetchForRoute(gpxData)).rejects.toThrow(
      'Overpass API fout: 400'
    );
    // Only the first endpoint should have been tried
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
