/**
 * Map module — manages the Leaflet map, route display, and markers.
 */

/* global L */

const MapManager = (() => {
  let map = null;
  let routeLayer = null;
  let knooppuntMarkers = [];
  let positionMarker = null;
  let accuracyCircle = null;
  let positionWatchActive = false;

  // Icons
  const knooppuntIcon = (name, isActive) =>
    L.divIcon({
      className: 'knooppunt-icon' + (isActive ? ' knooppunt-icon--active' : ''),
      html: `<span>${name}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

  const positionIcon = L.divIcon({
    className: 'position-icon',
    html: '<div class="position-dot"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  /**
   * Initialise the Leaflet map on the given container element ID.
   *
   * @param {string} containerId
   */
  function init(containerId) {
    map = L.map(containerId, { zoomControl: true });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Default view — centre of the Netherlands
    map.setView([52.1, 5.3], 8);
  }

  /**
   * Draw the route (track or route points) and knooppunten markers on the map.
   *
   * @param {object} gpxData - Parsed GPX data from parseGPX()
   */
  function displayRoute(gpxData) {
    clearRoute();

    const { knooppunten, trackPoints, routePoints } = gpxData;

    // Choose the path to draw: track preferred, then route points
    const pathPoints =
      trackPoints.length > 0
        ? trackPoints.map((p) => [p.lat, p.lon])
        : routePoints.map((p) => [p.lat, p.lon]);

    if (pathPoints.length > 0) {
      routeLayer = L.polyline(pathPoints, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
    }

    // Draw knooppunten markers
    knooppunten.forEach((k) => {
      if (k.isKnooppunt) {
        const marker = L.marker([k.lat, k.lon], {
          icon: knooppuntIcon(k.name, false),
          title: `Knooppunt ${k.name}`,
        })
          .addTo(map)
          .bindPopup(`<strong>Knooppunt ${k.name}</strong>`);
        knooppuntMarkers.push({ marker, name: k.name });
      }
    });

    // If we have route/waypoints but no track, fit to those
    if (pathPoints.length === 0 && knooppunten.length > 0) {
      const bounds = L.latLngBounds(knooppunten.map((k) => [k.lat, k.lon]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  /**
   * Update the user's position marker on the map.
   *
   * @param {{ lat: number, lon: number, accuracy: number }} position
   */
  function updatePosition(position) {
    const latlng = [position.lat, position.lon];

    if (!positionMarker) {
      positionMarker = L.marker(latlng, {
        icon: positionIcon,
        zIndexOffset: 1000,
        title: 'Uw positie',
      }).addTo(map);
    } else {
      positionMarker.setLatLng(latlng);
    }

    if (position.accuracy) {
      if (!accuracyCircle) {
        accuracyCircle = L.circle(latlng, {
          radius: position.accuracy,
          color: '#2563eb',
          fillColor: '#2563eb',
          fillOpacity: 0.1,
          weight: 1,
        }).addTo(map);
      } else {
        accuracyCircle.setLatLng(latlng);
        accuracyCircle.setRadius(position.accuracy);
      }
    }

    if (!positionWatchActive) {
      map.setView(latlng, Math.max(map.getZoom(), 14));
      positionWatchActive = true;
    }
  }

  /**
   * Highlight the active knooppunt marker and reset all others.
   *
   * @param {string} activeName
   */
  function setActiveKnooppunt(activeName) {
    knooppuntMarkers.forEach(({ marker, name }) => {
      marker.setIcon(knooppuntIcon(name, name === activeName));
    });
  }

  /**
   * Remove all route layers and markers from the map.
   */
  function clearRoute() {
    if (routeLayer) {
      map.removeLayer(routeLayer);
      routeLayer = null;
    }
    knooppuntMarkers.forEach(({ marker }) => map.removeLayer(marker));
    knooppuntMarkers = [];
    positionWatchActive = false;
  }

  /**
   * Pan/zoom the map to follow the current position.
   *
   * @param {{ lat: number, lon: number }} position
   */
  function panToPosition(position) {
    map.panTo([position.lat, position.lon]);
  }

  return { init, displayRoute, updatePosition, setActiveKnooppunt, clearRoute, panToPosition };
})();
