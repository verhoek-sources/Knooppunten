/**
 * Main application module — orchestrates the map, GPX parsing, and geolocation.
 */

/* global MapManager, GeoTracker, parseGPX, findNearestKnooppunt, formatDistance */

const App = (() => {
  let gpxData = null;
  let currentPosition = null;
  let passedKnooppunten = new Set();

  // DOM references (set in init)
  let fileInput = null;
  let statusEl = null;
  let knooppuntListEl = null;
  let trackingBtn = null;
  let centerBtn = null;

  /**
   * Initialise the application.
   */
  function init() {
    fileInput = document.getElementById('gpx-file');
    statusEl = document.getElementById('status');
    knooppuntListEl = document.getElementById('knooppunten-list');
    trackingBtn = document.getElementById('tracking-btn');
    centerBtn = document.getElementById('center-btn');

    MapManager.init('map');

    fileInput.addEventListener('change', handleFileChange);

    if (trackingBtn) {
      trackingBtn.addEventListener('click', toggleTracking);
    }
    if (centerBtn) {
      centerBtn.addEventListener('click', () => {
        if (currentPosition) {
          MapManager.panToPosition(currentPosition);
        }
      });
    }

    setStatus('Laad een GPX bestand om te beginnen.');
  }

  /**
   * Handle file input change — read and parse the selected GPX file.
   *
   * @param {Event} event
   */
  function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setStatus('Fout: selecteer een geldig GPX bestand.', 'error');
      return;
    }

    setStatus('Bestand laden…');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        gpxData = parseGPX(e.target.result);
        passedKnooppunten.clear();
        MapManager.displayRoute(gpxData);
        updateKnooppuntList();

        const count = gpxData.knooppunten.filter((k) => k.isKnooppunt).length;
        if (count > 0) {
          setStatus(`Route geladen met ${count} knooppunten. GPS tracking gestart.`);
        } else {
          setStatus('Route geladen. Geen knooppunten gevonden in dit GPX bestand.');
        }

        // Auto-start tracking when a file is loaded
        startTracking();
      } catch (err) {
        setStatus('Fout bij het lezen van het GPX bestand: ' + err.message, 'error');
      }
    };
    reader.onerror = () => {
      setStatus('Fout bij het lezen van het bestand.', 'error');
    };
    reader.readAsText(file);
  }

  /**
   * Start GPS tracking.
   */
  function startTracking() {
    if (GeoTracker.isTracking()) return;

    GeoTracker.start(onPositionUpdate, onGeoError);

    if (trackingBtn) {
      trackingBtn.textContent = '⏹ Stop tracking';
      trackingBtn.classList.add('tracking-btn--active');
    }
  }

  /**
   * Stop GPS tracking.
   */
  function stopTracking() {
    GeoTracker.stop();

    if (trackingBtn) {
      trackingBtn.textContent = '▶ Start tracking';
      trackingBtn.classList.remove('tracking-btn--active');
    }
  }

  /**
   * Toggle GPS tracking on/off.
   */
  function toggleTracking() {
    if (GeoTracker.isTracking()) {
      stopTracking();
    } else {
      startTracking();
    }
  }

  /**
   * Called whenever a new GPS position is received.
   *
   * @param {{ lat: number, lon: number, accuracy: number }} position
   */
  function onPositionUpdate(position) {
    currentPosition = position;
    MapManager.updatePosition(position);

    if (!gpxData) return;

    const knooppunten = gpxData.knooppunten.filter((k) => k.isKnooppunt);
    if (knooppunten.length === 0) return;

    const result = findNearestKnooppunt(position, knooppunten);
    if (!result) return;

    const { knooppunt, distance } = result;

    // Mark as passed if within 50 metres
    if (distance < 50) {
      passedKnooppunten.add(knooppunt.name);
    }

    MapManager.setActiveKnooppunt(knooppunt.name);
    updateKnooppuntList(knooppunt.name, distance);

    setStatus(
      `Dichtstbijzijnde knooppunt: <strong>${knooppunt.name}</strong> — ${formatDistance(distance)}`
    );
  }

  /**
   * Called when the Geolocation API returns an error.
   *
   * @param {string} message
   */
  function onGeoError(message) {
    setStatus('GPS fout: ' + message, 'error');
    if (trackingBtn) {
      trackingBtn.textContent = '▶ Start tracking';
      trackingBtn.classList.remove('tracking-btn--active');
    }
  }

  /**
   * Render the knooppunten list in the info panel.
   *
   * @param {string|null} activeKnooppuntName - Name of the currently nearest knooppunt
   * @param {number|null} activeDistance      - Distance to the nearest knooppunt in metres
   */
  function updateKnooppuntList(activeKnooppuntName = null, activeDistance = null) {
    if (!gpxData) {
      knooppuntListEl.innerHTML = '';
      return;
    }

    const knooppunten = gpxData.knooppunten.filter((k) => k.isKnooppunt);

    if (knooppunten.length === 0) {
      knooppuntListEl.innerHTML =
        '<p class="no-knooppunten">Geen knooppunten gevonden in dit GPX bestand.</p>';
      return;
    }

    const items = knooppunten
      .map((k) => {
        const passed = passedKnooppunten.has(k.name);
        const isActive = k.name === activeKnooppuntName;
        let distText = '';
        if (isActive && activeDistance !== null) {
          distText = `<span class="knooppunt-distance">${formatDistance(activeDistance)}</span>`;
        }
        return `<li class="knooppunt-item${passed ? ' knooppunt-item--passed' : ''}${isActive ? ' knooppunt-item--active' : ''}">
          <span class="knooppunt-badge">${k.name}</span>
          ${distText}
          ${passed ? '<span class="knooppunt-check">✓</span>' : ''}
        </li>`;
      })
      .join('');

    knooppuntListEl.innerHTML = `<ul class="knooppunten-list">${items}</ul>`;

    // Scroll the active item into view
    const activeItem = knooppuntListEl.querySelector('.knooppunt-item--active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Update the status bar.
   *
   * @param {string} message - HTML content
   * @param {'info'|'error'} type
   */
  function setStatus(message, type = 'info') {
    statusEl.innerHTML = message;
    statusEl.className = 'status status--' + type;
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
