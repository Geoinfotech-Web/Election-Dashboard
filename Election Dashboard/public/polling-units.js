/* ── Map initialisation ─────────────────────────────────────────────────── */
const map = L.map('pollingUnitsMap', {
  zoomControl: true,
  attributionControl: true,
  maxBoundsViscosity: 0.9,
  preferCanvas: true,
}).setView([9.06, 8.67], 6);

const pollingPointsPaneName = 'pollingPointsPane';

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

const TILE_URLS = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

let mapTheme = 'dark';
let currentTileLayer = L.tileLayer(TILE_URLS.dark, {
  maxZoom: 19,
  subdomains: 'abcd',
  attribution: TILE_ATTRIBUTION,
}).addTo(map);

/* ── DOM refs ───────────────────────────────────────────────────────────── */
const stateSelect        = document.getElementById('pollingStateSelect');
const lgaSelect          = document.getElementById('pollingLgaSelect');
const metricSelect       = document.getElementById('pollingMetricSelect');
const searchInput        = document.getElementById('pollingSearchInput');
const searchButton       = document.getElementById('pollingSearchButton');
const searchMessage      = document.getElementById('pollingSearchMessage');
const pollingAreaLabel   = document.getElementById('pollingAreaLabel');
const pollingAreaName    = document.getElementById('pollingAreaName');
const pollingUnitsValue  = document.getElementById('pollingUnitsValue');
const pollingWardsValue  = document.getElementById('pollingWardsValue');
const pollingPopulationLoadValue     = document.getElementById('pollingPopulationLoadValue');
const pollingUnitsPerPopulationValue = document.getElementById('pollingUnitsPerPopulationValue');
const pollingBandValue   = document.getElementById('pollingBandValue');
const pollingTopAreaValue= document.getElementById('pollingTopAreaValue');
const pollingSourceSummary = document.getElementById('pollingSourceSummary');
const pollingSourceName  = document.getElementById('pollingSourceName');
const pollingRowCount    = document.getElementById('pollingRowCount');
const pollingUpdatedAt   = document.getElementById('pollingUpdatedAt');
const pollingMethodology = document.getElementById('pollingMethodology');
const wardAnalysisStatus = document.getElementById('wardAnalysisStatus');
const wardAnalysisMatched = document.getElementById('wardAnalysisMatched');
const wardAnalysisUnmatched = document.getElementById('wardAnalysisUnmatched');
const pollingChartTitle  = document.getElementById('pollingChartTitle');
const panelResizer       = document.getElementById('pollingPanelResizer');
const populationGrid     = document.querySelector('.population-grid');
const wardStatusEl       = document.getElementById('wardStatus');
const wardStatusText     = document.getElementById('wardStatusText');
const userDistanceCard    = document.getElementById('userDistanceCard');
const userDistanceValue   = document.getElementById('userDistanceValue');
const locateMeButton      = document.getElementById('locateMeButton');
const locateMeMessage     = document.getElementById('locateMeMessage');
const locateResultCard    = document.getElementById('locateResultCard');
const locateResultContent = document.getElementById('locateResultContent');
const pollingGuideModal   = document.getElementById('pollingGuideModal');
const pollingGuideClose   = document.getElementById('pollingGuideClose');
const pollingReportCard   = document.getElementById('pollingReportCard');
const reportTitle         = document.getElementById('reportTitle');
const reportAreaName      = document.getElementById('reportAreaName');
const reportPuCount       = document.getElementById('reportPuCount');
const reportClosest       = document.getElementById('reportClosest');
const reportFarthest      = document.getElementById('reportFarthest');
const reportClosestValue  = document.getElementById('reportClosestValue');
const reportClosestMeta   = document.getElementById('reportClosestMeta');
const reportFarthestValue = document.getElementById('reportFarthestValue');
const reportFarthestMeta  = document.getElementById('reportFarthestMeta');
const reportSuggestions   = document.getElementById('reportSuggestions');
const reportUnitsList     = document.getElementById('reportUnitsList');
const downloadReportButton = document.getElementById('downloadReportButton');

/* Layer toggle checkboxes */
const toggleStates       = document.getElementById('toggleStates');
const toggleWards        = document.getElementById('toggleWards');
const togglePollingUnits = document.getElementById('togglePollingUnits');
const toggleUserLocation = document.getElementById('toggleUserLocation');
const toggleNearestRoute = document.getElementById('toggleNearestRoute');

/* ── State ──────────────────────────────────────────────────────────────── */
let adm0Data = null;
let adm1Data = null;   // state boundaries
let wardData = null;   // ward boundaries (adm3 — optional)
let pollingData = null;
let nigeriaBounds = null;
let pollingChart = null;

/* Map layer handles */
let stateLayer           = null;
let wardLayer            = null;
let pollingUnitPointsLayer   = null;
let userLocationLayer    = null;
let nearestRouteLayer    = null;
let highlightLayer       = null;
let locateMeDotLayer     = null;
let locateMeRouteLayer   = null;

/* Polling points (loaded once as static GeoJSON, like a shapefile) */
let allPollingUnitFeatures = [];   // all GeoJSON features from the server
let loadedPoints = [];             // flat array of properties for nearest-route calc

/* User geolocation */
let userLatLng = null;
let watchId    = null;

/* ── Metrics ────────────────────────────────────────────────────────────── */
const METRICS = {
  pollingUnits: {
    title: 'Polling Units',
    getValue: (row) => row?.pollingUnits ?? null,
    reverse: false,
    format: (v) => formatNumber(v, 0),
    note: 'Higher values show more polling units in the area.',
  },
  pollingUnitsPer100k: {
    title: 'Polling Units per 100k People',
    getValue: (row) => row?.pollingUnitsPer100k ?? null,
    reverse: false,
    format: (v) => formatNumber(v, 1),
    note: 'Higher values suggest stronger polling-unit availability per population.',
  },
  populationPerPollingUnit: {
    title: 'Population per Polling Unit',
    getValue: (row) => row?.populationPerPollingUnit ?? null,
    reverse: true,
    format: (v) => formatNumber(v, 1),
    note: 'Lower values suggest easier access — each unit serves fewer people.',
  },
  accessibilityScore: {
    title: 'Accessibility Score',
    getValue: (row) => row?.accessibilityScore ?? null,
    reverse: false,
    format: (v) => formatNumber(v, 0),
    note: 'Higher scores combine polling-unit count and population service pressure.',
  },
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
function normalizeStateName(value) {
  const text = String(value || '').trim();
  const key  = text.toLowerCase();
  if (['fct', 'fct, abuja', 'federal capital territory'].includes(key)) return 'FCT';
  return toDisplayCase(text);
}

function toDisplayCase(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s/-])([a-z])/g, (_, p, l) => `${p}${l.toUpperCase()}`);
}

function normalizeLookupKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/gi, '')
    .replace(/nassarawa/gi, 'nasarawa')
    .replace(/deltal/gi, 'delta')
    .toLowerCase();
}

function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || value === '') return '--';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits });
}

function formatDate(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDistance(metres) {
  if (!Number.isFinite(metres)) return '--';
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(1)} km`;
}

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function getCurrentMetric() {
  return METRICS[metricSelect.value] || METRICS.pollingUnits;
}

function getFeatureStateName(feature) {
  return normalizeStateName(feature.properties.NAME_1 || feature.properties.NAME_0 || 'Nigeria');
}

function getFeatureLgaCandidates(feature) {
  return [feature.properties.NAME_2, feature.properties.VARNAME_2, feature.properties.NL_NAME_2]
    .flatMap((v) => String(v || '').split('|'))
    .map((v) => v.trim())
    .filter(Boolean);
}

function getStateRow(state) {
  return (pollingData?.states || []).find(
    (r) => normalizeLookupKey(r.state) === normalizeLookupKey(state)
  );
}

function getStateFeatures() {
  return (adm1Data?.features || []).filter((f) => getFeatureStateName(f) !== 'Water Body');
}

function setSearchMessage(msg) { searchMessage.textContent = msg; }

function showPollingGuide() {
  if (!pollingGuideModal) return;
  const dismissed = localStorage.getItem('pollingGuideDismissed') === 'true';
  if (dismissed) {
    pollingGuideModal.classList.add('is-hidden');
    return;
  }
  pollingGuideModal.classList.remove('is-hidden');
}

function dismissPollingGuide() {
  if (!pollingGuideModal) return;
  localStorage.setItem('pollingGuideDismissed', 'true');
  pollingGuideModal.classList.add('is-hidden');
}

if (pollingGuideClose) {
  pollingGuideClose.addEventListener('click', dismissPollingGuide);
}

if (pollingGuideModal) {
  pollingGuideModal.addEventListener('click', (event) => {
    if (event.target === pollingGuideModal) dismissPollingGuide();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !pollingGuideModal.classList.contains('is-hidden')) {
      dismissPollingGuide();
    }
  });
}

/* ── Accessibility colours ──────────────────────────────────────────────── */
function getAccessibilityColor(band) {
  if (band === 'Broadly Accessible')  return '#22b573';
  if (band === 'Watch Pressure')      return '#f0c95b';
  if (band === 'Needs More Coverage') return '#f25c54';
  return '#63737b';
}

function ensurePollingPointsPane() {
  if (map.getPane(pollingPointsPaneName)) {
    return map.getPane(pollingPointsPaneName);
  }

  const pane = map.createPane(pollingPointsPaneName);
  pane.style.zIndex = '650';
  pane.style.pointerEvents = 'auto';
  return pane;
}

/* ── State boundary layer ───────────────────────────────────────────────── */
function renderStateBoundaries() {
  if (stateLayer) { map.removeLayer(stateLayer); stateLayer = null; }
  if (!adm1Data || !toggleStates.checked) return;

  stateLayer = L.geoJSON(
    { type: 'FeatureCollection', features: getStateFeatures() },
    {
      style: {
        color: mapTheme === 'light' ? '#1a3d4a' : '#ffffff',
        weight: 2,
        fillOpacity: 0,
        opacity: 0.85,
      },
      onEachFeature(feature, layer) {
        const stateName = getFeatureStateName(feature);
        layer.on('click', () => {
          stateSelect.value = stateName;
          updateLgaOptions();
          lgaSelect.value = '';
          updateDetailsPanel();
          renderPollingUnitPointsLayer();
          zoomToFeature(feature);
        });
        layer.bindTooltip(stateName, { permanent: false, direction: 'center', className: 'pu-state-tooltip' });
      },
    }
  ).addTo(map);
}

/* ── Ward boundary layer ────────────────────────────────────────────────── */
function renderWardBoundaries() {
  if (wardLayer) { map.removeLayer(wardLayer); wardLayer = null; }
  if (!wardData || !toggleWards.checked) return;

  wardLayer = L.geoJSON(wardData, {
    interactive: false,
    style: {
      color: mapTheme === 'light' ? 'rgba(0,60,80,0.28)' : 'rgba(255,255,255,0.3)',
      weight: 0.8,
      fillOpacity: 0,
      opacity: 1,
      dashArray: '2,4',
    },
  }).addTo(map);
}

function setWardStatus(message, visible) {
  wardStatusText.textContent = message;
  wardStatusEl.classList.toggle('is-hidden', !visible);
}

/* ── Polling unit highlight ─────────────────────────────────────────────── */
function setHighlight(feature) {
  if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }
  if (!feature) return;
  highlightLayer = L.geoJSON(feature, {
    interactive: false,
    style: { color: '#5fe09b', weight: 3, fillOpacity: 0, opacity: 1 },
  }).addTo(map);
}

/* ── Polling unit points (loaded once as GeoJSON, like a shapefile) ──────── */
function clearPollingUnitPointsLayer() {
  if (pollingUnitPointsLayer) { map.removeLayer(pollingUnitPointsLayer); pollingUnitPointsLayer = null; }
}

function getPollingUnitPopupContent(props) {
  const loc = [props.ward, props.lga, props.state].filter(Boolean).join(', ');
  const placement =
    props.geometrySource === 'source'
      ? 'Exact source coordinate'
      : props.geometrySource === 'csv-latlong'
        ? 'CSV geocoded coordinate'
      : props.geometrySource === 'google-geocode'
        ? 'Google geocoded address'
        : 'Estimated from local area';
  return `
    <strong>${props.name || 'Polling Unit'}</strong>
    <span>${loc || 'Nigeria'}</span>
    <span>Accessibility: ${props.band || '--'}</span>
    <span>Pop. per PU: ${formatNumber(props.pop_pu, 0)}</span>
    <span>PUs per 100k: ${formatNumber(props.pu_100k, 1)}</span>
    <span>Placement: ${placement}</span>
  `;
}

function renderPollingUnitPointsLayer() {
  clearPollingUnitPointsLayer();
  loadedPoints = [];
  if (!togglePollingUnits.checked || !allPollingUnitFeatures.length) return;

  const state = stateSelect.value;
  const lga   = lgaSelect.value;

  if (!state || !lga) return;

  const features = allPollingUnitFeatures.filter((f) => {
    if (normalizeLookupKey(f.properties.state) !== normalizeLookupKey(state)) return false;
    if (normalizeLookupKey(f.properties.lga) !== normalizeLookupKey(lga)) return false;
    return true;
  });

  if (!features.length) return;

  /* build flat point list for nearest-route calculations */
  loadedPoints = features.map((f) => ({
    latitude:  f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
    ...f.properties,
  }));

  pollingUnitPointsLayer = L.geoJSON(
    { type: 'FeatureCollection', features },
    {
      pane: pollingPointsPaneName,
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: feature.properties.geometrySource === 'source' ? 4.8 : 4,
          color:
            feature.properties.geometrySource === 'source'
              ? '#ffffff'
              : feature.properties.geometrySource === 'csv-latlong'
                ? '#244d38'
              : feature.properties.geometrySource === 'google-geocode'
                ? '#3d2f00'
                : '#1f2c3a',
          weight: feature.properties.geometrySource === 'source' ? 1.1 : 0.8,
          opacity: feature.properties.geometrySource === 'source' ? 1 : 0.9,
          fillColor:
            feature.properties.geometrySource === 'source'
              ? getAccessibilityColor(feature.properties.band)
              : feature.properties.geometrySource === 'csv-latlong'
                ? '#42d392'
              : feature.properties.geometrySource === 'google-geocode'
                ? '#ffbf47'
                : '#8aa0b7',
          fillOpacity: feature.properties.geometrySource === 'source' ? 0.95 : 0.75,
        }),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(getPollingUnitPopupContent(feature.properties));
      },
    }
  ).addTo(map);

  pollingUnitPointsLayer.bringToFront();

  if (toggleNearestRoute.checked && userLatLng) renderNearestRoute();
  renderAreaReport();
}

function focusSelectedPollingArea() {
  const state = stateSelect.value;
  if (!state) {
    if (nigeriaBounds?.isValid()) {
      map.fitBounds(nigeriaBounds, { padding: [18, 18] });
    }
    return;
  }

  const feature = getStateFeatures().find(
    (f) => normalizeLookupKey(getFeatureStateName(f)) === normalizeLookupKey(state)
  );

  if (feature) {
    zoomToFeature(feature);
  }
}

async function loadPollingUnitPointsGeoJSON() {
  try {
    pollingSourceSummary.textContent = 'Loading polling unit points…';
    const response = await fetch('/api/polling-units.geojson');
    if (!response.ok) throw new Error('Unable to load polling unit GeoJSON.');
    const geojson = await response.json();
    allPollingUnitFeatures = geojson.features || [];
    renderPollingUnitPointsLayer();
    const counts = geojson?.source?.counts || {};
    const estimatedCount = Number(counts.estimated || 0);
    const geocodedCount = Number(counts.geocoded || 0);
    const csvCount = Number(counts.csvLatLong || 0);
    const exactCount = Number(counts.exact || 0);
    pollingSourceSummary.textContent =
      `${formatNumber(allPollingUnitFeatures.length)} polling units across Nigeria` +
      (estimatedCount || geocodedCount || csvCount
        ? ` · ${formatNumber(exactCount)} exact, ${formatNumber(csvCount)} CSV, ${formatNumber(geocodedCount)} geocoded, ${formatNumber(estimatedCount)} estimated`
        : '');
  } catch (error) {
    console.warn('Failed to load polling unit GeoJSON:', error);
    pollingSourceSummary.textContent = 'Failed to load polling unit points.';
  }
}

/* ── User location ──────────────────────────────────────────────────────── */
function clearUserLocation() {
  if (userLocationLayer) { map.removeLayer(userLocationLayer); userLocationLayer = null; }
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  userLatLng = null;
  userDistanceCard.classList.add('is-hidden');
}

function applyUserLocation(position) {
  userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
  const accuracy = position.coords.accuracy;

  if (userLocationLayer) { map.removeLayer(userLocationLayer); userLocationLayer = null; }

  userLocationLayer = L.layerGroup();

  L.circle(userLatLng, {
    radius: accuracy,
    color: '#4fc3f7',
    fillColor: '#4fc3f7',
    fillOpacity: 0.08,
    weight: 1,
    interactive: false,
  }).addTo(userLocationLayer);

  L.circleMarker(userLatLng, {
    radius: 9,
    color: '#ffffff',
    weight: 2.5,
    fillColor: '#4fc3f7',
    fillOpacity: 1,
  }).bindPopup(
    `<strong>Your Location</strong><span>Accuracy: ±${Math.round(accuracy)} m</span>`
  ).addTo(userLocationLayer);

  userLocationLayer.addTo(map);
  map.panTo(userLatLng);

  if (toggleNearestRoute.checked) renderNearestRoute();
  renderAreaReport();
}

function activateUserLocation() {
  if (!('geolocation' in navigator)) {
    alert('Geolocation is not supported by your browser.');
    toggleUserLocation.checked = false;
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    applyUserLocation,
    (err) => {
      console.warn('Geolocation error:', err);
      setSearchMessage('Unable to get your location. Check browser permissions.');
      toggleUserLocation.checked = false;
      clearUserLocation();
      if (toggleNearestRoute.checked) { toggleNearestRoute.checked = false; clearNearestRoute(); }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );
}

/* ── Nearest route ──────────────────────────────────────────────────────── */
function clearNearestRoute() {
  if (nearestRouteLayer) { map.removeLayer(nearestRouteLayer); nearestRouteLayer = null; }
  userDistanceCard.classList.add('is-hidden');
}

function renderNearestRoute() {
  clearNearestRoute();

  if (!userLatLng || !loadedPoints.length) return;

  let nearest = null;
  let minDist  = Infinity;

  for (const pt of loadedPoints) {
    const dist = userLatLng.distanceTo(L.latLng(pt.latitude, pt.longitude));
    if (dist < minDist) { minDist = dist; nearest = pt; }
  }

  if (!nearest) return;

  const nearestLatLng = L.latLng(nearest.latitude, nearest.longitude);

  nearestRouteLayer = L.layerGroup();

  L.polyline([userLatLng, nearestLatLng], {
    color: '#f0c95b',
    weight: 2.5,
    dashArray: '6,5',
    opacity: 0.9,
    interactive: false,
  }).addTo(nearestRouteLayer);

  L.circleMarker(nearestLatLng, {
    radius: 6,
    color: '#f0c95b',
    weight: 2,
    fillColor: '#f0c95b',
    fillOpacity: 0.9,
  }).bindPopup(
    `<strong>${nearest.pollingUnit || 'Nearest Polling Unit'}</strong>` +
    `<span>${[nearest.ward, nearest.lga, nearest.state].filter(Boolean).join(', ')}</span>` +
    `<span>Distance: ${formatDistance(minDist)}</span>`
  ).addTo(nearestRouteLayer);

  nearestRouteLayer.addTo(map);

  userDistanceCard.classList.remove('is-hidden');
  userDistanceValue.textContent = formatDistance(minDist);
}

/* ── Map theme toggle ───────────────────────────────────────────────────── */
function toggleMapTheme() {
  mapTheme = mapTheme === 'dark' ? 'light' : 'dark';

  map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(TILE_URLS[mapTheme], {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: TILE_ATTRIBUTION,
  }).addTo(map);
  currentTileLayer.bringToBack();

  const mapPanel = document.querySelector('.map-panel');
  mapPanel.classList.toggle('map-light', mapTheme === 'light');

  const lbl = document.querySelector('.mtt-label');
  if (lbl) lbl.textContent = mapTheme === 'light' ? 'Dark Map' : 'Light Map';

  /* Re-render boundaries so line colours match the new basemap */
  renderStateBoundaries();
  renderWardBoundaries();
}

document.getElementById('mapThemeToggle').addEventListener('click', toggleMapTheme);

/* ── Locate Me ──────────────────────────────────────────────────────────── */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistancePrecise(metres) {
  if (!Number.isFinite(metres)) return '--';
  return metres < 1000
    ? `${metres.toFixed(2)} m`
    : `${(metres / 1000).toFixed(2)} km`;
}

function clearLocateMe() {
  if (locateMeDotLayer)   { map.removeLayer(locateMeDotLayer);   locateMeDotLayer   = null; }
  if (locateMeRouteLayer) { map.removeLayer(locateMeRouteLayer); locateMeRouteLayer = null; }
  locateResultCard.classList.add('is-hidden');
  locateResultContent.innerHTML = '';
}

function getStateRegisteredVoters(stateName) {
  const row = (pollingData?.states || []).find(
    (r) => normalizeLookupKey(r.state) === normalizeLookupKey(stateName)
  );
  return row?.registeredVoters ?? null;
}

function renderLocateResultCard(nearest3) {
  locateResultContent.innerHTML = '';
  nearest3.forEach((pt, i) => {
    const voters  = getStateRegisteredVoters(pt.state);
    const isFirst = i === 0;
    const item = document.createElement('div');
    item.className = `locate-pu-item${isFirst ? ' is-nearest' : ''}`;
    item.innerHTML =
      `<p class="locate-pu-item-name"><span class="locate-pu-rank">#${i + 1}</span>${pt.name || 'Polling Unit'}</p>` +
      `<p class="locate-pu-item-loc">${[pt.ward, pt.lga, pt.state].filter(Boolean).join(', ')}</p>` +
      `<div class="locate-pu-item-meta">` +
        `<span class="locate-pu-item-dist">${formatDistancePrecise(pt._distance)}</span>` +
        `<span class="locate-pu-item-voters">${voters !== null ? formatNumber(voters) + ' reg. voters (state)' : '--'}</span>` +
      `</div>`;
    locateResultContent.appendChild(item);
  });
  locateResultCard.classList.remove('is-hidden');
}

function locateMe() {
  if (!('geolocation' in navigator)) {
    locateMeMessage.textContent = 'Geolocation is not supported by your browser.';
    return;
  }

  locateMeButton.disabled = true;
  locateMeButton.classList.add('is-locating');
  locateMeMessage.textContent = 'Locating…';
  clearLocateMe();

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude: lat, longitude: lon } = position.coords;
        const userPos = L.latLng(lat, lon);

        /* Reverse geocode with Nominatim */
        let address = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'User-Agent': 'Nigeria Election GIS Dashboard' } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            address = geoData.display_name || address;
          }
        } catch { /* fall back to coordinates */ }

        /* Pulsing blue dot marker */
        const pulsingIcon = L.divIcon({
          className: '',
          html: '<div class="locate-me-dot"><div class="locate-me-ring"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -16],
        });

        locateMeDotLayer = L.marker(userPos, { icon: pulsingIcon })
          .bindPopup(`<strong>Your Location</strong><span>${address}</span>`)
          .addTo(map);
        map.panTo(userPos);

        if (!loadedPoints.length) {
          locateMeMessage.textContent = 'Polling unit data not yet loaded — try again shortly.';
          return;
        }

        /* Haversine distances to every loaded point, find 3 nearest */
        const nearest3 = loadedPoints
          .map((pt) => ({ ...pt, _distance: haversineDistance(lat, lon, pt.latitude, pt.longitude) }))
          .sort((a, b) => a._distance - b._distance)
          .slice(0, 3);

        const nearest       = nearest3[0];
        const nearestLatLng = L.latLng(nearest.latitude, nearest.longitude);

        locateMeRouteLayer = L.layerGroup();

        /* Dashed red line user → nearest PU */
        L.polyline([userPos, nearestLatLng], {
          color: '#ff3d3d',
          dashArray: '6,6',
          weight: 2,
          opacity: 0.9,
          interactive: false,
        }).addTo(locateMeRouteLayer);

        /* Nearest PU highlighted with large red circle */
        L.circleMarker(nearestLatLng, {
          radius: 10,
          color: '#ffffff',
          weight: 2,
          fillColor: '#ff3d3d',
          fillOpacity: 1,
        }).bindPopup(
          `<strong>${nearest.name || 'Nearest Polling Unit'}</strong>` +
          `<span>${[nearest.ward, nearest.lga, nearest.state].filter(Boolean).join(', ')}</span>` +
          `<span>Distance: ${formatDistancePrecise(nearest._distance)}</span>`
        ).addTo(locateMeRouteLayer);

        locateMeRouteLayer.addTo(map);

        /* Result card */
        renderLocateResultCard(nearest3);
        renderAreaReport();
        locateMeMessage.textContent =
          `Nearest: ${nearest.name || 'polling unit'} — ${formatDistancePrecise(nearest._distance)}`;
      } catch (err) {
        console.error('Locate Me error:', err);
        locateMeMessage.textContent = 'Something went wrong while locating. Please try again.';
      } finally {
        locateMeButton.disabled = false;
        locateMeButton.classList.remove('is-locating');
      }
    },
    (err) => {
      locateMeButton.disabled = false;
      locateMeButton.classList.remove('is-locating');
      locateMeMessage.textContent = err.code === 1
        ? 'Location access denied. Please enable location in your browser settings.'
        : 'Unable to determine your location. Please try again.';
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}

locateMeButton.addEventListener('click', locateMe);

/* ── Layer toggle handlers ──────────────────────────────────────────────── */
toggleStates.addEventListener('change', renderStateBoundaries);

toggleWards.addEventListener('change', () => {
  if (wardData) {
    renderWardBoundaries();
  } else if (toggleWards.checked) {
    setWardStatus('Ward boundaries not available — place adm3.zip in data/boundaries/', true);
    setTimeout(() => setWardStatus('', false), 4000);
  }
});

togglePollingUnits.addEventListener('change', () => {
  renderPollingUnitPointsLayer();
});

toggleUserLocation.addEventListener('change', () => {
  if (toggleUserLocation.checked) {
    activateUserLocation();
  } else {
    clearUserLocation();
    if (toggleNearestRoute.checked) { toggleNearestRoute.checked = false; clearNearestRoute(); }
  }
});

toggleNearestRoute.addEventListener('change', () => {
  if (!toggleNearestRoute.checked) {
    clearNearestRoute();
    return;
  }
  if (!toggleUserLocation.checked) {
    toggleUserLocation.checked = true;
    activateUserLocation();
  }
  if (userLatLng) renderNearestRoute();
});

/* ── Zoom / move ────────────────────────────────────────────────────────── */
/* ── Zoom helpers ───────────────────────────────────────────────────────── */
function zoomToFeature(feature) {
  if (!feature) {
    if (nigeriaBounds) map.fitBounds(nigeriaBounds, { padding: [18, 18] });
    return;
  }
  const bounds = L.geoJSON(feature).getBounds();
  if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { padding: [18, 18] });
}

/* ── Right-panel details ────────────────────────────────────────────────── */
function updateSourceDetails() {
  const source = pollingData?.source;
  if (!source) return;
  pollingSourceSummary.textContent = `${source.name} • ${formatNumber(source.rowCount)} rows`;
  pollingSourceName.textContent    = source.name;
  pollingRowCount.textContent      = formatNumber(source.rowCount);
  pollingUpdatedAt.textContent     = formatDate(source.modifiedTime);
  pollingMethodology.textContent   = pollingData.methodology ||
    'Accessibility derived from polling unit counts and population coverage.';
}

async function loadWardAnalysisSummary() {
  if (!wardAnalysisStatus || !wardAnalysisMatched || !wardAnalysisUnmatched) return;

  try {
    const response = await fetch('/data/ward_pu_summary.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Ward analysis summary not generated yet.');
    }

    const summary = await response.json();
    wardAnalysisStatus.textContent = 'Loaded';
    wardAnalysisMatched.textContent = formatNumber(summary.total_wards_matched ?? 0);
    wardAnalysisUnmatched.textContent = formatNumber(summary.total_unmatched_pus ?? 0);
  } catch (error) {
    wardAnalysisStatus.textContent = 'Not generated';
    wardAnalysisMatched.textContent = '--';
    wardAnalysisUnmatched.textContent = '--';
  }
}

function buildChart(labels, values, label) {
  const canvas = document.getElementById('pollingChart');
  if (!canvas || !window.Chart) return;
  if (pollingChart) pollingChart.destroy();
  pollingChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        backgroundColor: '#22b573',
        borderColor: '#0d3c31',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#d9ece4', maxRotation: 65, minRotation: 65, autoSkip: false }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: '#d9ece4' }, grid: { color: 'rgba(255,255,255,0.08)' } },
      },
    },
  });
}

function updateChart(selection = {}) {
  const { state, lga } = selection;
  if (!pollingData) return;

  if (state && lga) {
    const row = (pollingData.lgas || []).find(
      (r) => normalizeLookupKey(r.state) === normalizeLookupKey(state) &&
             normalizeLookupKey(r.lga) === normalizeLookupKey(lga)
    );
    const topWards = row?.topWards || [];
    pollingChartTitle.textContent = 'Top Wards by Polling Units';
    buildChart(topWards.map((w) => w.ward), topWards.map((w) => w.pollingUnits), 'Polling Units');
    return;
  }

  if (state) {
    const rows = (pollingData.lgas || [])
      .filter((r) => normalizeLookupKey(r.state) === normalizeLookupKey(state))
      .sort((a, b) => b.pollingUnits - a.pollingUnits).slice(0, 10);
    pollingChartTitle.textContent = `${state} — LGAs by Polling Units`;
    buildChart(rows.map((r) => r.lga), rows.map((r) => r.pollingUnits), 'Polling Units');
    return;
  }

  const stateRows = [...(pollingData.states || [])].sort((a, b) => b.pollingUnits - a.pollingUnits).slice(0, 10);
  pollingChartTitle.textContent = 'Top States by Polling Units';
  buildChart(stateRows.map((r) => r.state), stateRows.map((r) => r.pollingUnits), 'Polling Units');
}

function getNationalBand(pop) {
  if (!Number.isFinite(pop)) return '--';
  if (pop <= 900)  return 'Broadly Accessible';
  if (pop <= 1150) return 'Watch Pressure';
  return 'Needs More Coverage';
}

function getFilteredPollingUnitFeatures() {
  const state = stateSelect.value;
  const lga = lgaSelect.value;

  if (!state || !lga) return [];

  return (allPollingUnitFeatures || []).filter((f) => {
    if (normalizeLookupKey(f.properties.state) !== normalizeLookupKey(state)) return false;
    if (normalizeLookupKey(f.properties.lga) !== normalizeLookupKey(lga)) return false;
    return true;
  });
}

function formatTravelTime(distanceKm) {
  if (!Number.isFinite(distanceKm)) return '--';
  const minutes = distanceKm / 5 * 60;
  if (minutes < 60) return `${Math.round(minutes)} min walk`;
  return `${(minutes / 60).toFixed(1)} hr walk`;
}

function renderAreaReport() {
  const state = stateSelect.value;
  const lga = lgaSelect.value;

  if (!pollingData || !pollingReportCard) {
    return;
  }

  const features = getFilteredPollingUnitFeatures();
  if (!state || !lga || !features.length) {
    pollingReportCard.classList.add('is-hidden');
    return;
  }

  pollingReportCard.classList.remove('is-hidden');
  reportTitle.textContent = lga ? `${lga} report` : 'Area report';

  const areaLabel = lga && state ? `${lga}, ${state}` : state || 'Selected area';
  reportAreaName.textContent = areaLabel;
  reportPuCount.textContent = formatNumber(features.length);

  const points = features
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      return {
        ...feature.properties,
        latitude: lat,
        longitude: lng,
      };
    })
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  if (userLatLng) {
    points.forEach((point) => {
      point._distance = userLatLng.distanceTo(L.latLng(point.latitude, point.longitude)) / 1000;
    });
  }

  let closest = null;
  let farthest = null;
  let closestDistance = null;
  let farthestDistance = null;

  if (userLatLng && points.length) {
    points.forEach((point) => {
      const distanceKm = point._distance;
      if (closestDistance === null || distanceKm < closestDistance) {
        closestDistance = distanceKm;
        closest = point;
      }
      if (farthestDistance === null || distanceKm > farthestDistance) {
        farthestDistance = distanceKm;
        farthest = point;
      }
    });
  }

  reportClosest.textContent = closest ? closest.name || 'Polling Unit' : '--';
  reportFarthest.textContent = farthest ? farthest.name || 'Polling Unit' : '--';

  if (closest) {
    reportClosestValue.textContent = `${closest.name || 'Polling Unit'}`;
    reportClosestMeta.textContent = userLatLng
      ? `${formatNumber(closestDistance, 1)} km • ${formatTravelTime(closestDistance)}`
      : 'Tap Locate Me for travel distance';
  } else {
    reportClosestValue.textContent = '--';
    reportClosestMeta.textContent = 'Tap Locate Me for travel distance';
  }

  if (farthest) {
    reportFarthestValue.textContent = `${farthest.name || 'Polling Unit'}`;
    reportFarthestMeta.textContent = userLatLng
      ? `${formatNumber(farthestDistance, 1)} km • ${formatTravelTime(farthestDistance)}`
      : 'Tap Locate Me for travel distance';
  } else {
    reportFarthestValue.textContent = '--';
    reportFarthestMeta.textContent = 'Tap Locate Me for travel distance';
  }

  const suggestions = [];
  if (!userLatLng) {
    suggestions.push('Tap Locate Me so the report can show the closest and farthest polling units from your position.');
  }
  if (closestDistance !== null && closestDistance > 3) {
    suggestions.push('The nearest polling unit is farther than expected, so transport support or a new access point may help.');
  }
  if (farthestDistance !== null && farthestDistance > 8) {
    suggestions.push('Some polling units are quite far away, so consider additional outreach or better route planning.');
  }
  const row = (pollingData.lgas || []).find(
    (r) => normalizeLookupKey(r.state) === normalizeLookupKey(state) && normalizeLookupKey(r.lga) === normalizeLookupKey(lga)
  );
  if (row?.accessibilityBand === 'Needs More Coverage') {
    suggestions.push('This LGA needs more coverage, so adding or redistributing polling units would improve access.');
  } else if (row?.accessibilityBand === 'Watch Pressure') {
    suggestions.push('This area is under watch pressure, so more support during peak periods would help.');
  } else {
    suggestions.push('Coverage looks generally healthy, so keep monitoring and supporting the busiest wards.');
  }

  reportSuggestions.innerHTML = suggestions.map((item) => `<li>${item}</li>`).join('');

  reportUnitsList.innerHTML = points
    .map((point) => {
      const unitName = point.name || 'Polling Unit';
      const locationText = [point.ward, point.lga, point.state].filter(Boolean).join(', ');
      const distanceText = userLatLng && Number.isFinite(point._distance)
        ? `${formatNumber(point._distance, 1)} km`
        : 'Distance pending';
      return `<div class="report-unit-item"><strong>${unitName}</strong><span>${locationText}</span><span>${distanceText}</span></div>`;
    })
    .join('');
}

function updateDetailsPanel() {
  if (!pollingData) return;

  const state = stateSelect.value;
  const lga   = lgaSelect.value;

  if (state && lga) {
    const row = (pollingData.lgas || []).find(
      (r) => normalizeLookupKey(r.state) === normalizeLookupKey(state) &&
             normalizeLookupKey(r.lga)   === normalizeLookupKey(lga)
    );
    if (!row) return;
    pollingAreaLabel.textContent              = 'Selected LGA';
    pollingAreaName.textContent               = `${row.lga}, ${row.state}`;
    pollingUnitsValue.textContent             = formatNumber(row.pollingUnits);
    pollingWardsValue.textContent             = formatNumber(row.wards);
    pollingPopulationLoadValue.textContent    = formatNumber(row.populationPerPollingUnit, 1);
    pollingUnitsPerPopulationValue.textContent= formatNumber(row.pollingUnitsPer100k, 1);
    pollingBandValue.textContent              = row.accessibilityBand || '--';
    pollingTopAreaValue.textContent           = row.topWards?.[0]
      ? `${row.topWards[0].ward} (${formatNumber(row.topWards[0].pollingUnits)})`
      : '--';
    updateChart({ state, lga });
    return;
  }

  if (state) {
    const row = getStateRow(state);
    if (!row) return;
    pollingAreaLabel.textContent              = 'Selected State';
    pollingAreaName.textContent               = row.state;
    pollingUnitsValue.textContent             = formatNumber(row.pollingUnits);
    pollingWardsValue.textContent             = formatNumber(row.wards);
    pollingPopulationLoadValue.textContent    = formatNumber(row.populationPerPollingUnit, 1);
    pollingUnitsPerPopulationValue.textContent= formatNumber(row.pollingUnitsPer100k, 1);
    pollingBandValue.textContent              = row.accessibilityBand || '--';
    pollingTopAreaValue.textContent           = row.topLgaByPollingUnits
      ? `${row.topLgaByPollingUnits.lga} (${formatNumber(row.topLgaByPollingUnits.pollingUnits)})`
      : '--';
    updateChart({ state });
    return;
  }

  const summary = pollingData.summary;
  pollingAreaLabel.textContent              = 'Country';
  pollingAreaName.textContent               = 'Nigeria';
  pollingUnitsValue.textContent             = formatNumber(summary.totalPollingUnits);
  pollingWardsValue.textContent             = formatNumber(summary.totalWards);
  pollingPopulationLoadValue.textContent    = formatNumber(summary.nationalPopulationPerPollingUnit, 1);
  pollingUnitsPerPopulationValue.textContent= formatNumber(summary.nationalPollingUnitsPer100k, 1);
  pollingBandValue.textContent              = getNationalBand(summary.nationalPopulationPerPollingUnit);
  pollingTopAreaValue.textContent           = summary.topStateByPollingUnits
    ? `${summary.topStateByPollingUnits.state} (${formatNumber(summary.topStateByPollingUnits.pollingUnits)})`
    : '--';
  updateChart();
}

/* ── Filter dropdowns ───────────────────────────────────────────────────── */
function populateStateOptions() {
  const current = stateSelect.value;
  stateSelect.innerHTML = '<option value="">All States</option>';
  for (const row of pollingData.states || []) {
    const opt = document.createElement('option');
    opt.value = row.state;
    opt.textContent = row.state;
    stateSelect.append(opt);
  }
  stateSelect.value = current;
}

function updateLgaOptions() {
  const current = lgaSelect.value;
  lgaSelect.innerHTML = '<option value="">All LGAs</option>';
  if (!stateSelect.value) return;

  const lgas = (pollingData.lgas || [])
    .filter((r) => normalizeLookupKey(r.state) === normalizeLookupKey(stateSelect.value))
    .sort((a, b) => a.lga.localeCompare(b.lga));

  for (const row of lgas) {
    const opt = document.createElement('option');
    opt.value = row.lga;
    opt.textContent = row.lga;
    lgaSelect.append(opt);
  }

  if (lgas.some((r) => normalizeLookupKey(r.lga) === normalizeLookupKey(current))) {
    lgaSelect.value = current;
  }
}

/* ── Search ─────────────────────────────────────────────────────────────── */
function searchArea() {
  const query = normalizeLookupKey(searchInput.value);
  if (!query) { setSearchMessage('Enter a state or LGA name to search.'); return; }

  const matchState = (pollingData.states || []).find((r) =>
    normalizeLookupKey(r.state).includes(query)
  );

  if (matchState) {
    stateSelect.value = matchState.state;
    updateLgaOptions();
    lgaSelect.value = '';
    updateDetailsPanel();
    renderAllBoundaries();
    renderPollingUnitPointsLayer();
    const feat = getStateFeatures().find(
      (f) => normalizeLookupKey(getFeatureStateName(f)) === normalizeLookupKey(matchState.state)
    );
    zoomToFeature(feat);
    setSearchMessage(`Showing ${matchState.state}.`);
    return;
  }

  const matchLga = (pollingData.lgas || []).find(
    (r) => normalizeLookupKey(r.lga).includes(query) ||
           normalizeLookupKey(`${r.lga} ${r.state}`).includes(query)
  );

  if (matchLga) {
    stateSelect.value = matchLga.state;
    updateLgaOptions();
    lgaSelect.value = matchLga.lga;
    updateDetailsPanel();
    renderAllBoundaries();
    renderPollingUnitPointsLayer();
    setSearchMessage(`Showing ${matchLga.lga}, ${matchLga.state}.`);
    return;
  }

  setSearchMessage('No matching state or LGA found.');
}

/* ── Render all boundary layers ─────────────────────────────────────────── */
function renderAllBoundaries() {
  renderStateBoundaries();
  renderWardBoundaries();
  if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }

  if (stateSelect.value) {
    const feat = getStateFeatures().find(
      (f) => normalizeLookupKey(getFeatureStateName(f)) === normalizeLookupKey(stateSelect.value)
    );
    if (feat) setHighlight(feat);
  }
}

/* ── Panel resizer ──────────────────────────────────────────────────────── */
function setDetailsPanelWidth(width) {
  if (!populationGrid) return;
  const gridWidth = populationGrid.getBoundingClientRect().width;
  const nextWidth = clamp(width, 280, Math.max(280, gridWidth - 320));
  populationGrid.style.setProperty('--details-panel-width', `${nextWidth}px`);
  window.requestAnimationFrame(() => map.invalidateSize());
}

function initializePanelResizer() {
  if (!populationGrid || !panelResizer) return;
  let isResizing = false;

  const resize = (clientX) => {
    setDetailsPanelWidth(populationGrid.getBoundingClientRect().right - clientX);
  };

  panelResizer.addEventListener('pointerdown', (e) => {
    isResizing = true;
    panelResizer.setPointerCapture(e.pointerId);
    populationGrid.classList.add('is-resizing');
    resize(e.clientX);
  });

  panelResizer.addEventListener('pointermove', (e) => { if (isResizing) resize(e.clientX); });

  panelResizer.addEventListener('pointerup', (e) => {
    isResizing = false;
    panelResizer.releasePointerCapture(e.pointerId);
    populationGrid.classList.remove('is-resizing');
  });

  panelResizer.addEventListener('pointercancel', () => {
    isResizing = false;
    populationGrid.classList.remove('is-resizing');
  });
}

/* ── Data loaders ───────────────────────────────────────────────────────── */
async function loadBoundary(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load: ${url}`);
  return shp(await response.arrayBuffer());
}

async function loadPollingDashboardData() {
  const response = await fetch('/api/polling-units-data');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to load polling unit data.');
  }
  return response.json();
}

/* ── Event listeners ────────────────────────────────────────────────────── */
stateSelect.addEventListener('change', () => {
  updateLgaOptions();
  lgaSelect.value = '';
  clearPollingUnitPointsLayer();
  loadedPoints = [];
  updateDetailsPanel();
  renderAllBoundaries();
  renderAreaReport();
});

document.getElementById('applyPollingFilters').addEventListener('click', () => {
  updateDetailsPanel();
  renderAllBoundaries();
  renderPollingUnitPointsLayer();
  focusSelectedPollingArea();
});

document.getElementById('resetPollingFilters').addEventListener('click', () => {
  metricSelect.value = 'pollingUnits';
  stateSelect.value  = '';
  updateLgaOptions();
  lgaSelect.value    = '';
  searchInput.value  = '';
  setSearchMessage('');
  updateDetailsPanel();
  renderAllBoundaries();
  renderPollingUnitPointsLayer();
  focusSelectedPollingArea();
  renderAreaReport();
});

searchButton.addEventListener('click', searchArea);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchArea(); } });
metricSelect.addEventListener('change', () => { /* metric affects the chart/panel only */ updateDetailsPanel(); });
lgaSelect.addEventListener('change', () => {
  updateDetailsPanel();
  renderPollingUnitPointsLayer();
  renderAreaReport();
});

if (downloadReportButton) {
  downloadReportButton.addEventListener('click', () => {
    const state = stateSelect.value;
    const lga = lgaSelect.value;
    const features = getFilteredPollingUnitFeatures();
    const safeArea = (lga && state ? `${lga}-${state}` : state || 'selected-area').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeArea} report</title><style>body{font-family:Arial,sans-serif;background:#071116;color:#f7fbf8;padding:24px}h1{color:#22b573}.card{background:#10212b;border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px;margin-bottom:16px}.pill{display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(34,181,115,0.18);margin:4px 6px 4px 0;color:#bfeadb}.item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)}.suggestion{padding:8px 10px;border-radius:8px;background:rgba(255,191,71,0.16);margin:6px 0}</style></head><body><h1>${(lga && state ? `${lga}, ${state}` : state || 'Selected area')} report</h1><div class="card"><strong>Polling units:</strong> ${features.length}<br><strong>Closest:</strong> ${reportClosest.textContent || '--'}<br><strong>Farthest:</strong> ${reportFarthest.textContent || '--'}</div><div class="card"><h2>Suggestions</h2>${reportSuggestions.innerHTML.replace(/<li>/g, '<div class="suggestion">').replace(/<\/li>/g, '</div>')}</div><div class="card"><h2>All polling units</h2>${reportUnitsList.innerHTML}</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeArea}-report.html`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

window.addEventListener('resize', () => window.requestAnimationFrame(() => map.invalidateSize()));

/* ── Init ───────────────────────────────────────────────────────────────── */
async function initPollingMap() {
  try {
    [adm0Data, adm1Data, pollingData] = await Promise.all([
      loadBoundary('data/boundaries/adm0.zip'),
      loadBoundary('data/boundaries/adm1.zip'),
      loadPollingDashboardData(),
    ]);

    nigeriaBounds = L.geoJSON(adm0Data).getBounds();

    /* Try to load ward boundaries — optional */
    try {
      wardData = await loadBoundary('data/boundaries/adm3.zip');
      setWardStatus('', false);
    } catch {
      wardData = null;
      if (toggleWards.checked) {
        setWardStatus('Ward boundaries (adm3.zip) not found — add to data/boundaries/ to enable', true);
        setTimeout(() => setWardStatus('', false), 6000);
      }
    }

    populateStateOptions();
    updateLgaOptions();
    updateSourceDetails();
    loadWardAnalysisSummary();
    updateDetailsPanel();

    renderAllBoundaries();

    /* load polling unit points as a static GeoJSON layer (like a shapefile) */
    loadPollingUnitPointsGeoJSON();
  } catch (error) {
    console.error('Failed to initialize polling dashboard:', error);
    pollingSourceSummary.textContent = error.message || 'Failed to load.';
    setSearchMessage('Polling unit dashboard failed to load.');
  }
}

initializePanelResizer();
ensurePollingPointsPane();
showPollingGuide();
initPollingMap();
