# Knooppunten

A web application that reads GPX files, tracks your GPS position, and shows your location within a [knooppunten](https://en.wikipedia.org/wiki/Node_network) route.

**Knooppunten** (Dutch for "junction points") are numbered nodes used in cycling and hiking networks in the Netherlands and Belgium. Riders plan routes by linking numbered junctions — e.g. `1 → 5 → 23 → 44 → 67`.

![Screenshot of the Knooppunten app](https://github.com/user-attachments/assets/96328b97-38fe-492f-bf06-c2b39718ee96)

## Features

- 📂 **Load a GPX file** — supports waypoints, route points (`<rtept>`), and track segments (`<trkpt>`)
- 🗺️ **Interactive map** — displays the route as a blue line with numbered knooppunt markers (powered by [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/))
- 📍 **GPS tracking** — watches your browser's Geolocation and shows a live position marker
- 🔢 **Nearest knooppunt** — highlights the knooppunt you're closest to and shows the distance
- ✓ **Route progress** — marks knooppunten as passed (within 50 m) so you can see where you are in the route

## Getting started

The app is a static website — no build step required. Simply open `index.html` in a browser, or serve the directory with any HTTP server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then open `http://localhost:8080` and load a GPX file.

### Example GPX file

An example GPX file with five knooppunten on the Veluwe is included: [`example.gpx`](example.gpx).

## GPX format

The app recognises waypoints and route points whose `<name>` is a 1–2 digit number as knooppunten:

```xml
<wpt lat="52.0762" lon="5.8521">
  <name>1</name>
</wpt>
```

Track segments (`<trkpt>`) are used to draw the route path on the map.

## Development

### Prerequisites

- Node.js ≥ 18

### Install

```bash
npm install
```

### Run tests

```bash
npm test
```

Tests cover the GPX parser, Haversine distance calculation, nearest-knooppunt lookup, and distance formatting (21 unit tests using [Jest](https://jestjs.io/)).
