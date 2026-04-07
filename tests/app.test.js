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
    </div>
    <div id="knooppunten-list" aria-live="polite" aria-label="Knooppunten lijst"></div>
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
