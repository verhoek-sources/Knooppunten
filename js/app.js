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
  let gpxContentBtn = null;
  let gpxModal = null;
  let gpxModalBody = null;
  let gpxModalCloseBtn = null;

  /**
   * Initialise the application.
   */
  function init() {
    fileInput = document.getElementById('gpx-file');
    statusEl = document.getElementById('status');
    knooppuntListEl = document.getElementById('knooppunten-list');
    trackingBtn = document.getElementById('tracking-btn');
    centerBtn = document.getElementById('center-btn');
    gpxContentBtn = document.getElementById('gpx-content-btn');
    gpxModal = document.getElementById('gpx-modal');
    gpxModalBody = document.getElementById('gpx-modal-body');

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
    if (gpxContentBtn) {
      gpxContentBtn.addEventListener('click', showGpxContent);
    }
    if (gpxModal) {
      gpxModalCloseBtn = document.getElementById('gpx-modal-close');
      if (gpxModalCloseBtn) {
        gpxModalCloseBtn.addEventListener('click', closeGpxContent);
      }
      const backdrop = gpxModal.querySelector('.modal__backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', closeGpxContent);
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !gpxModal.hidden) {
          closeGpxContent();
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

        // Reveal the GPX content button now that a file is loaded
        if (gpxContentBtn) {
          gpxContentBtn.hidden = false;
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
   * Render route summary info (waypoints and trackpoints) when no knooppunten are present.
   * Uses safe DOM APIs to prevent XSS with user-supplied waypoint names.
   */
  function renderNoKnooppuntenInfo() {
    const container = document.createElement('div');
    container.className = 'route-summary';

    // ── Numbered nodes (none found) ──────────────────────────
    const noKnooppuntenP = document.createElement('p');
    noKnooppuntenP.className = 'no-knooppunten';
    noKnooppuntenP.textContent = 'Geen knooppunten gevonden.';
    container.appendChild(noKnooppuntenP);

    // ── Waypoints ────────────────────────────────────────────
    const allWaypoints = gpxData.knooppunten; // all wpt elements (isKnooppunt = false here)
    if (allWaypoints.length > 0) {
      const heading = document.createElement('p');
      heading.className = 'route-summary__heading';
      heading.textContent = `Waypoints (${allWaypoints.length})`;
      container.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'waypoints-list';
      allWaypoints.forEach((wp) => {
        const li = document.createElement('li');
        li.className = 'waypoint-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'waypoint-name';
        nameSpan.textContent = wp.name || '—';
        li.appendChild(nameSpan);

        const coordSpan = document.createElement('span');
        coordSpan.className = 'gpx-coords';
        coordSpan.textContent = `${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)}`;
        li.appendChild(coordSpan);

        list.appendChild(li);
      });
      container.appendChild(list);
    }

    // ── Trackpoints count ────────────────────────────────────
    if (gpxData.trackPoints.length > 0) {
      const p = document.createElement('p');
      p.className = 'route-summary__stat';
      const strong = document.createElement('strong');
      strong.textContent = 'Trackpunten: ';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(String(gpxData.trackPoints.length)));
      container.appendChild(p);
    }

    // ── Route points count ───────────────────────────────────
    if (gpxData.routePoints.length > 0) {
      const p = document.createElement('p');
      p.className = 'route-summary__stat';
      const strong = document.createElement('strong');
      strong.textContent = 'Routepunten: ';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(String(gpxData.routePoints.length)));
      container.appendChild(p);
    }

    knooppuntListEl.textContent = '';
    knooppuntListEl.appendChild(container);
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
      renderNoKnooppuntenInfo();
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

    // Scroll the active item into view (behavior: 'smooth' omitted for Safari compatibility)
    const activeItem = knooppuntListEl.querySelector('.knooppunt-item--active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
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

  /**
   * Build a labelled section element for the GPX content modal.
   *
   * @param {string} title
   * @returns {HTMLElement}
   */
  function buildGpxSection(title) {
    const section = document.createElement('section');
    section.className = 'gpx-section';

    const heading = document.createElement('h3');
    heading.className = 'gpx-section__title';
    heading.textContent = title;
    section.appendChild(heading);

    return section;
  }

  /**
   * Append a key-value paragraph to an element using only safe text nodes.
   *
   * @param {HTMLElement} parent
   * @param {string} label
   * @param {string} value
   */
  function appendDetail(parent, label, value) {
    const p = document.createElement('p');
    p.className = 'gpx-detail';
    const strong = document.createElement('strong');
    strong.textContent = label;
    p.appendChild(strong);
    p.appendChild(document.createTextNode(value));
    parent.appendChild(p);
  }

  /**
   * Render GPX content inside the modal using safe DOM APIs (no innerHTML
   * with user-provided data, preventing XSS).
   */
  function showGpxContent() {
    if (!gpxData || !gpxModal || !gpxModalBody) return;

    // Clear previous content
    gpxModalBody.textContent = '';

    const { metadata, knooppunten, trackPoints, routePoints } = gpxData;
    const knooppuntItems = knooppunten.filter((k) => k.isKnooppunt);

    // ── Route metadata ───────────────────────────────────────
    if (metadata && (metadata.name || metadata.desc)) {
      const section = buildGpxSection('Route informatie');
      if (metadata.name) {
        appendDetail(section, 'Naam: ', metadata.name);
      }
      if (metadata.desc) {
        appendDetail(section, 'Beschrijving: ', metadata.desc);
      }
      gpxModalBody.appendChild(section);
    }

    // ── Knooppunten ──────────────────────────────────────────
    {
      const section = buildGpxSection(`Knooppunten (${knooppuntItems.length})`);
      if (knooppuntItems.length === 0) {
        const p = document.createElement('p');
        p.className = 'gpx-detail gpx-detail--muted';
        p.textContent = 'Geen knooppunten gevonden.';
        section.appendChild(p);
      } else {
        const list = document.createElement('ol');
        list.className = 'gpx-knooppunt-list';
        knooppuntItems.forEach((k) => {
          const li = document.createElement('li');
          li.className = 'gpx-knooppunt-item';
          const badge = document.createElement('span');
          badge.className = 'knooppunt-badge';
          badge.textContent = k.name;
          li.appendChild(badge);
          const coords = document.createElement('span');
          coords.className = 'gpx-coords';
          coords.textContent = `${k.lat.toFixed(5)}, ${k.lon.toFixed(5)}`;
          li.appendChild(coords);
          list.appendChild(li);
        });
        section.appendChild(list);
      }
      gpxModalBody.appendChild(section);
    }

    // ── Statistics ───────────────────────────────────────────
    {
      const section = buildGpxSection('Statistieken');
      appendDetail(section, 'Knooppunten: ', String(knooppuntItems.length));
      appendDetail(section, 'Waypoints: ', String(knooppunten.length));
      appendDetail(section, 'Trackpunten: ', String(trackPoints.length));
      if (routePoints.length > 0) {
        appendDetail(section, 'Routepunten: ', String(routePoints.length));
      }
      gpxModalBody.appendChild(section);
    }

    gpxModal.hidden = false;
    if (gpxModalCloseBtn) {
      gpxModalCloseBtn.focus();
    }
  }

  /**
   * Hide the GPX content modal.
   */
  function closeGpxContent() {
    if (gpxModal) {
      gpxModal.hidden = true;
      if (gpxContentBtn) {
        gpxContentBtn.focus();
      }
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());

// Export for Node.js/Jest (tests) while keeping global for browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { App };
}
