/**
 * Geolocation module — wraps the browser Geolocation API.
 */

const GeoTracker = (() => {
  let watchId = null;
  let onPositionCallback = null;
  let onErrorCallback = null;

  const options = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000,
  };

  /**
   * Start watching the device's GPS position.
   *
   * @param {function} onPosition - Called with { lat, lon, accuracy, heading, speed } on each update
   * @param {function} onError    - Called with an error message string on failure
   */
  function start(onPosition, onError) {
    if (!navigator.geolocation) {
      onError('GPS wordt niet ondersteund door uw browser.');
      return;
    }

    onPositionCallback = onPosition;
    onErrorCallback = onError;

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onPositionCallback({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
      },
      (err) => {
        const messages = {
          1: 'Toegang tot GPS geweigerd. Controleer uw browserinstellingen.',
          2: 'GPS positie niet beschikbaar.',
          3: 'GPS verzoek verlopen.',
        };
        onErrorCallback(messages[err.code] || 'Onbekende GPS fout.');
      },
      options
    );
  }

  /**
   * Stop watching the GPS position.
   */
  function stop() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  /**
   * Returns true if currently tracking.
   *
   * @returns {boolean}
   */
  function isTracking() {
    return watchId !== null;
  }

  return { start, stop, isTracking };
})();

// Export for Node.js/Jest (tests) while keeping global for browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeoTracker };
}
