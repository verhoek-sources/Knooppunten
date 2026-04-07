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
  <div id="gpx-modal" class="modal" role="dialog" aria-modal="true" hidden>
    <div class="modal__backdrop"></div>
    <div class="modal__panel" role="document">
      <div class="modal__header">
        <h2 id="gpx-modal-title" class="modal__title">GPX inhoud</h2>
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
    expect(input.getAttribute('accept')).toBe('.gpx');
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

describe('Home screen – no knooppunten found', () => {
  let originalFileReader;

  beforeEach(() => {
    originalFileReader = global.FileReader;
    const modal = document.getElementById('gpx-modal');
    if (modal) modal.hidden = true;
  });

  afterEach(() => {
    global.FileReader = originalFileReader;
  });

  function loadGpxContent(gpxContent) {
    global.FileReader = class {
      readAsText() {
        this.onload({ target: { result: gpxContent } });
      }
    };
    const input = document.getElementById('gpx-file');
    const file = new File([gpxContent], 'route.gpx', { type: 'application/gpx+xml' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  test('opens the GPX content modal automatically when no knooppunten are found', () => {
    const gpxWithoutKnooppunten = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.0" lon="5.0"><name>Start</name></wpt>
  <trk><trkseg><trkpt lat="52.0" lon="5.0"/></trkseg></trk>
</gpx>`;

    loadGpxContent(gpxWithoutKnooppunten);

    const modal = document.getElementById('gpx-modal');
    expect(modal.hidden).toBe(false);
  });

  test('does not open the GPX content modal automatically when knooppunten are found', () => {
    const gpxWithKnooppunten = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.0762" lon="5.8521"><name>42</name></wpt>
</gpx>`;

    loadGpxContent(gpxWithKnooppunten);

    const modal = document.getElementById('gpx-modal');
    expect(modal.hidden).toBe(true);
  });
});
