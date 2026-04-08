'use strict';

// ── Mock Leaflet (L) ─────────────────────────────────────────────────────────

const mockMap = {
  setView: jest.fn().mockReturnThis(),
  removeLayer: jest.fn(),
  fitBounds: jest.fn(),
  getZoom: jest.fn().mockReturnValue(10),
  panTo: jest.fn(),
};

const mockPolyline = {
  addTo: jest.fn().mockReturnThis(),
  getBounds: jest.fn().mockReturnValue({}),
};

const mockMarker = {
  addTo: jest.fn().mockReturnThis(),
  bindPopup: jest.fn().mockReturnThis(),
  setLatLng: jest.fn(),
  setIcon: jest.fn(),
};

const mockCircle = {
  addTo: jest.fn().mockReturnThis(),
  setLatLng: jest.fn(),
  setRadius: jest.fn(),
};

global.L = {
  map: jest.fn().mockReturnValue(mockMap),
  tileLayer: jest.fn().mockReturnValue({ addTo: jest.fn() }),
  polyline: jest.fn().mockReturnValue(mockPolyline),
  marker: jest.fn().mockReturnValue(mockMarker),
  circle: jest.fn().mockReturnValue(mockCircle),
  divIcon: jest.fn().mockReturnValue({}),
  latLngBounds: jest.fn().mockReturnValue({}),
};

// ── Mock Geolocation ─────────────────────────────────────────────────────────

Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  },
  configurable: true,
});

// ── Set up DOM ────────────────────────────────────────────────────────────────

document.body.innerHTML = `
  <header>
    <h1>&#128204; Knooppunten</h1>
    <div class="file-input-wrapper">
      <label for="gpx-file">&#128194; Laad GPX</label>
      <input type="file" id="gpx-file" accept=".gpx" aria-label="Laad GPX bestand" />
    </div>
  </header>
  <div id="map" role="region" aria-label="Kaart"></div>
  <div id="info-panel" role="complementary" aria-label="Route informatie">
    <div id="status" class="status status--info">
      Laad een GPX bestand om te beginnen.
    </div>
    <div class="panel-toolbar">
      <button id="tracking-btn" class="btn btn--primary" type="button">
        &#9654; Start tracking
      </button>
      <button id="center-btn" class="btn" type="button">
        &#10022; Centreer
      </button>
      <button id="gpx-content-btn" class="btn" type="button" hidden>
        &#128203; GPX inhoud
      </button>
    </div>
    <div id="knooppunten-list" aria-live="polite" aria-label="Knooppunten lijst"></div>
  </div>
  <div id="gpx-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="gpx-modal-title" hidden>
    <div class="modal__backdrop"></div>
    <div class="modal__panel" role="document">
      <div class="modal__header">
        <h2 id="gpx-modal-title" class="modal__title">GPX inhoud</h2>
        <button id="gpx-raw-btn" class="btn modal__raw-btn" type="button">&#128196; Ruw</button>
        <button id="gpx-modal-close" class="btn modal__close" type="button" aria-label="Sluiten">&#10005;</button>
      </div>
      <div id="gpx-modal-body" class="modal__body"></div>
    </div>
  </div>
`;

// ── Load modules ─────────────────────────────────────────────────────────────

const gpxParser = require('../js/gpx-parser');
global.parseGPX = gpxParser.parseGPX;
global.findNearestKnooppunt = gpxParser.findNearestKnooppunt;
global.formatDistance = gpxParser.formatDistance;

const { MapManager } = require('../js/map');
global.MapManager = MapManager;

const { GeoTracker } = require('../js/geolocation');
global.GeoTracker = GeoTracker;

const { App } = require('../js/app');

// Initialise the app (simulates DOMContentLoaded)
App.init();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Home screen – DOM structure', () => {
  test('has a map container', () => {
    expect(document.getElementById('map')).not.toBeNull();
  });

  test('has a file input that accepts GPX files', () => {
    const input = document.getElementById('gpx-file');
    expect(input).not.toBeNull();
    expect(input.getAttribute('type')).toBe('file');
    const accept = input.getAttribute('accept');
    expect(accept).toBe('.gpx');
  });

  test('file input has an accessible label', () => {
    const input = document.getElementById('gpx-file');
    expect(input.getAttribute('aria-label')).toBeTruthy();
  });

  test('has a tracking button', () => {
    const btn = document.getElementById('tracking-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('type')).toBe('button');
  });

  test('has a centre button', () => {
    const btn = document.getElementById('center-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('type')).toBe('button');
  });

  test('has an info panel with accessibility role', () => {
    const panel = document.getElementById('info-panel');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('role')).toBe('complementary');
  });

  test('knooppunten list container is present', () => {
    expect(document.getElementById('knooppunten-list')).not.toBeNull();
  });
});

describe('Home screen – initial state after init', () => {
  test('shows the initial status message', () => {
    const status = document.getElementById('status');
    expect(status.textContent.trim()).toBe('Laad een GPX bestand om te beginnen.');
  });

  test('status element has the info class', () => {
    const status = document.getElementById('status');
    expect(status.classList.contains('status--info')).toBe(true);
    expect(status.classList.contains('status--error')).toBe(false);
  });

  test('tracking button is not in active state', () => {
    const btn = document.getElementById('tracking-btn');
    expect(btn.classList.contains('tracking-btn--active')).toBe(false);
  });

  test('knooppunten list is empty', () => {
    const list = document.getElementById('knooppunten-list');
    expect(list.innerHTML.trim()).toBe('');
  });

  test('initialises the Leaflet map on the map container', () => {
    expect(global.L.map).toHaveBeenCalledWith('map', expect.objectContaining({ zoomControl: true }));
  });
});

describe('Home screen – file input validation', () => {
  test('rejects non-GPX files with an error status', () => {
    const input = document.getElementById('gpx-file');
    const file = new File(['content'], 'route.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));

    const status = document.getElementById('status');
    expect(status.classList.contains('status--error')).toBe(true);
  });
});

describe('MapManager – auto-scroll to user location', () => {
  beforeEach(() => {
    mockMap.setView.mockClear();
    mockMap.getZoom.mockReturnValue(10);
  });

  test('pans to user position on the first GPS update', () => {
    MapManager.updatePosition({ lat: 52.0, lon: 5.1, accuracy: 10 });
    expect(mockMap.setView).toHaveBeenCalledWith([52.0, 5.1], expect.any(Number));
  });

  test('pans to user position on every subsequent GPS update', () => {
    MapManager.updatePosition({ lat: 52.0, lon: 5.1, accuracy: 10 });
    MapManager.updatePosition({ lat: 52.1, lon: 5.2, accuracy: 10 });
    MapManager.updatePosition({ lat: 52.2, lon: 5.3, accuracy: 10 });

    expect(mockMap.setView).toHaveBeenCalledTimes(3);
    expect(mockMap.setView).toHaveBeenLastCalledWith([52.2, 5.3], expect.any(Number));
  });

  test('uses at least zoom level 14 when auto-panning', () => {
    mockMap.getZoom.mockReturnValue(5);
    MapManager.updatePosition({ lat: 52.0, lon: 5.1, accuracy: 10 });
    expect(mockMap.setView).toHaveBeenCalledWith([52.0, 5.1], 14);
  });

  test('preserves higher zoom level when already zoomed in', () => {
    mockMap.getZoom.mockReturnValue(17);
    MapManager.updatePosition({ lat: 52.0, lon: 5.1, accuracy: 10 });
    expect(mockMap.setView).toHaveBeenCalledWith([52.0, 5.1], 17);
  });
});

// ── Helper: simulate loading a GPX file via the file input ────────────────────

function loadGpxFile(gpxContent) {
  const OrigFileReader = global.FileReader;
  global.FileReader = class {
    readAsText() {
      this.onload({ target: { result: gpxContent } });
    }
  };
  const input = document.getElementById('gpx-file');
  const file = new File([gpxContent], 'route.gpx', { type: 'application/gpx+xml' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  global.FileReader = OrigFileReader;
}

// ── No-knooppunten GPX panel ──────────────────────────────────────────────────

describe('No-knooppunten GPX – panel shows waypoints and trackpoints', () => {
  const noKnooppuntenGPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="51.5012" lon="5.1034">
    <name>Startpunt</name>
  </wpt>
  <wpt lat="51.5123" lon="5.1145">
    <name>Eindpunt</name>
  </wpt>
  <trk>
    <trkseg>
      <trkpt lat="51.5000" lon="5.1000"><ele>5</ele></trkpt>
      <trkpt lat="51.5050" lon="5.1050"><ele>6</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

  beforeEach(() => {
    loadGpxFile(noKnooppuntenGPX);
  });

  test('shows the no-knooppunten message', () => {
    const noMsg = document.querySelector('#knooppunten-list .no-knooppunten');
    expect(noMsg).not.toBeNull();
    expect(noMsg.textContent).toContain('Geen knooppunten gevonden');
  });

  test('shows all waypoint names', () => {
    const list = document.getElementById('knooppunten-list');
    expect(list.textContent).toContain('Startpunt');
    expect(list.textContent).toContain('Eindpunt');
  });

  test('shows waypoint coordinates', () => {
    const coords = document.querySelectorAll('#knooppunten-list .gpx-coords');
    expect(coords.length).toBe(2);
    expect(coords[0].textContent).toContain('51.50120');
    expect(coords[0].textContent).toContain('5.10340');
  });

  test('shows trackpoints count', () => {
    const list = document.getElementById('knooppunten-list');
    expect(list.textContent).toContain('Trackpunten');
    expect(list.textContent).toContain('2');
  });

  test('waypoints are rendered in a list', () => {
    const waypointItems = document.querySelectorAll('#knooppunten-list .waypoint-item');
    expect(waypointItems.length).toBe(2);
  });
});

describe('No-knooppunten GPX with route points – panel shows route point count', () => {
  const routeOnlyGPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <rtept lat="51.5012" lon="5.1034"><name>Punt A</name></rtept>
    <rtept lat="51.5123" lon="5.1145"><name>Punt B</name></rtept>
    <rtept lat="51.5200" lon="5.1200"><name>Punt C</name></rtept>
  </rte>
</gpx>`;

  beforeEach(() => {
    loadGpxFile(routeOnlyGPX);
  });

  test('shows route points count when no track points exist', () => {
    const list = document.getElementById('knooppunten-list');
    expect(list.textContent).toContain('Routepunten');
    expect(list.textContent).toContain('3');
  });
});

// ── Raw GPX button ────────────────────────────────────────────────────────────

describe('Raw GPX button – DOM structure', () => {
  test('modal contains a raw GPX button', () => {
    const btn = document.getElementById('gpx-raw-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('type')).toBe('button');
  });
});

describe('Raw GPX button – shows raw file content', () => {
  const sampleGPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.3000" lon="4.8000">
    <name>42</name>
  </wpt>
</gpx>`;

  beforeEach(() => {
    loadGpxFile(sampleGPX);
  });

  test('clicking the raw button reveals the modal', () => {
    const modal = document.getElementById('gpx-modal');
    expect(modal.hidden).toBe(true);
    document.getElementById('gpx-raw-btn').click();
    expect(modal.hidden).toBe(false);
  });

  test('raw modal body contains a pre element with the raw XML', () => {
    document.getElementById('gpx-raw-btn').click();
    const pre = document.querySelector('#gpx-modal-body .gpx-raw');
    expect(pre).not.toBeNull();
    expect(pre.tagName).toBe('PRE');
  });

  test('raw pre element contains the exact GPX source text', () => {
    document.getElementById('gpx-raw-btn').click();
    const pre = document.querySelector('#gpx-modal-body .gpx-raw');
    expect(pre.textContent).toContain('<?xml version="1.0"');
    expect(pre.textContent).toContain('<gpx version="1.1"');
    expect(pre.textContent).toContain('<name>42</name>');
  });

  test('close button hides the modal after raw view', () => {
    document.getElementById('gpx-raw-btn').click();
    const modal = document.getElementById('gpx-modal');
    expect(modal.hidden).toBe(false);
    document.getElementById('gpx-modal-close').click();
    expect(modal.hidden).toBe(true);
  });
});

