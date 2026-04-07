'use strict';

// In the test environment gpx-parser.js exports its functions via module.exports
const {
  parseGPX,
  isKnooppuntName,
  haversineDistance,
  findNearestKnooppunt,
  formatDistance,
} = require('../js/gpx-parser');

// ── isKnooppuntName ────────────────────────────────────────────────────────────

describe('isKnooppuntName', () => {
  test('single digit numbers are knooppunten', () => {
    expect(isKnooppuntName('1')).toBe(true);
    expect(isKnooppuntName('9')).toBe(true);
  });

  test('two digit numbers are knooppunten', () => {
    expect(isKnooppuntName('23')).toBe(true);
    expect(isKnooppuntName('99')).toBe(true);
  });

  test('three digit numbers are NOT knooppunten', () => {
    expect(isKnooppuntName('100')).toBe(false);
    expect(isKnooppuntName('999')).toBe(false);
  });

  test('text names are NOT knooppunten', () => {
    expect(isKnooppuntName('Start')).toBe(false);
    expect(isKnooppuntName('Café')).toBe(false);
    expect(isKnooppuntName('')).toBe(false);
  });

  test('numbers with leading/trailing spaces are recognised', () => {
    expect(isKnooppuntName(' 7 ')).toBe(true);
  });
});

// ── haversineDistance ──────────────────────────────────────────────────────────

describe('haversineDistance', () => {
  test('distance between the same point is 0', () => {
    expect(haversineDistance(51.5, 5.1, 51.5, 5.1)).toBe(0);
  });

  test('known distance between Amsterdam and Utrecht is approx 35 km', () => {
    const d = haversineDistance(52.3676, 4.9041, 52.0907, 5.1214);
    // Roughly 34 km – allow ± 5 km for a simple sanity check
    expect(d).toBeGreaterThan(29000);
    expect(d).toBeLessThan(39000);
  });

  test('short distance is measured in metres', () => {
    // ~111 metres per 0.001 degree latitude
    const d = haversineDistance(51.5, 5.1, 51.501, 5.1);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

// ── findNearestKnooppunt ────────────────────────────────────────────────────────

describe('findNearestKnooppunt', () => {
  const knooppunten = [
    { lat: 51.5, lon: 5.1, name: '23' },
    { lat: 51.6, lon: 5.2, name: '45' },
    { lat: 51.4, lon: 5.0, name: '12' },
  ];

  test('returns null for an empty list', () => {
    expect(findNearestKnooppunt({ lat: 51.5, lon: 5.1 }, [])).toBeNull();
  });

  test('returns null when knooppunten is undefined', () => {
    expect(findNearestKnooppunt({ lat: 51.5, lon: 5.1 }, undefined)).toBeNull();
  });

  test('finds the nearest knooppunt', () => {
    const result = findNearestKnooppunt({ lat: 51.5, lon: 5.1 }, knooppunten);
    expect(result.knooppunt.name).toBe('23');
    expect(result.distance).toBe(0);
  });

  test('returns correct knooppunt when position is between two', () => {
    // Slightly closer to 45 than 23
    const result = findNearestKnooppunt({ lat: 51.58, lon: 5.18 }, knooppunten);
    expect(result.knooppunt.name).toBe('45');
  });
});

// ── formatDistance ─────────────────────────────────────────────────────────────

describe('formatDistance', () => {
  test('formats metres below 1000', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(250)).toBe('250 m');
    expect(formatDistance(999)).toBe('999 m');
  });

  test('formats kilometres at 1000 and above', () => {
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(2500)).toBe('2.5 km');
    expect(formatDistance(12345)).toBe('12.3 km');
  });
});

// ── parseGPX ───────────────────────────────────────────────────────────────────

describe('parseGPX', () => {
  const sampleGPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="51.5012" lon="5.1034">
    <name>23</name>
  </wpt>
  <wpt lat="51.5123" lon="5.1145">
    <name>45</name>
  </wpt>
  <wpt lat="51.5200" lon="5.1200">
    <name>Startpunt</name>
  </wpt>
  <trk>
    <trkseg>
      <trkpt lat="51.5000" lon="5.1000"><ele>5</ele></trkpt>
      <trkpt lat="51.5050" lon="5.1050"><ele>6</ele></trkpt>
      <trkpt lat="51.5100" lon="5.1100"><ele>7</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

  test('parses knooppunten waypoints', () => {
    const { knooppunten } = parseGPX(sampleGPX);
    const numbered = knooppunten.filter((k) => k.isKnooppunt);
    expect(numbered).toHaveLength(2);
    expect(numbered.map((k) => k.name)).toEqual(expect.arrayContaining(['23', '45']));
  });

  test('marks non-numeric waypoints as non-knooppunten', () => {
    const { knooppunten } = parseGPX(sampleGPX);
    const startpunt = knooppunten.find((k) => k.name === 'Startpunt');
    expect(startpunt).toBeDefined();
    expect(startpunt.isKnooppunt).toBe(false);
  });

  test('parses track points', () => {
    const { trackPoints } = parseGPX(sampleGPX);
    expect(trackPoints).toHaveLength(3);
    expect(trackPoints[0]).toEqual({ lat: 51.5, lon: 5.1, ele: 5 });
  });

  test('returns correct lat/lon for knooppunten', () => {
    const { knooppunten } = parseGPX(sampleGPX);
    const k23 = knooppunten.find((k) => k.name === '23');
    expect(k23.lat).toBeCloseTo(51.5012);
    expect(k23.lon).toBeCloseTo(5.1034);
  });

  test('throws on invalid XML', () => {
    expect(() => parseGPX('<notvalid><<')).toThrow();
  });

  test('returns metadata name and description', () => {
    const withMetadata = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Mijn route</name>
    <desc>Een mooie fietstocht</desc>
  </metadata>
</gpx>`;
    const { metadata } = parseGPX(withMetadata);
    expect(metadata.name).toBe('Mijn route');
    expect(metadata.desc).toBe('Een mooie fietstocht');
  });

  test('returns empty metadata when metadata element is absent', () => {
    const noMetadata = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="51.5" lon="5.1"><name>1</name></wpt>
</gpx>`;
    const { metadata } = parseGPX(noMetadata);
    expect(metadata.name).toBe('');
    expect(metadata.desc).toBe('');
  });

  test('metadata fields are trimmed', () => {
    const whitespace = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>  Route met spaties  </name>
    <desc>  Beschrijving  </desc>
  </metadata>
</gpx>`;
    const { metadata } = parseGPX(whitespace);
    expect(metadata.name).toBe('Route met spaties');
    expect(metadata.desc).toBe('Beschrijving');
  });

  const routeGPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <rtept lat="51.5012" lon="5.1034"><name>12</name></rtept>
    <rtept lat="51.5123" lon="5.1145"><name>34</name></rtept>
  </rte>
</gpx>`;

  test('extracts knooppunten from route points', () => {
    const { knooppunten, routePoints } = parseGPX(routeGPX);
    expect(routePoints).toHaveLength(2);
    expect(knooppunten.map((k) => k.name)).toEqual(expect.arrayContaining(['12', '34']));
  });

  test('does not duplicate knooppunten found in both wpt and rtept', () => {
    const combined = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="1.0" lon="2.0"><name>5</name></wpt>
  <rte>
    <rtept lat="1.0" lon="2.0"><name>5</name></rtept>
    <rtept lat="1.1" lon="2.1"><name>6</name></rtept>
  </rte>
</gpx>`;
    const { knooppunten } = parseGPX(combined);
    const names = knooppunten.map((k) => k.name);
    // knooppunt 5 should appear only once
    expect(names.filter((n) => n === '5')).toHaveLength(1);
  });
});
