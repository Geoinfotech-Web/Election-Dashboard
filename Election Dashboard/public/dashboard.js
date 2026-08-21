(function () {
  const THEME_KEY = 'electionDashboardTheme';
  const pageParameters = new URLSearchParams(window.location.search);
  const body = document.body;
  const themeButton = document.querySelector('[data-intel-theme]');
  const navigationButtons = Array.from(document.querySelectorAll('[data-intel-section]'));
  const views = Array.from(document.querySelectorAll('[data-intel-view]'));
  const stateFilter = document.getElementById('intel-state-filter');
  const yearFilter = document.getElementById('intel-year-filter');
  const typeFilter = document.getElementById('intel-type-filter');
  const statusFilter = document.getElementById('intel-status-filter');
  const sectionMeta = {
    overview: ['Nigeria · National overview', 'Election intelligence', 'A source-aware view of electoral geography, participation, population, and available results.'],
    population: ['Nigeria · Population & demographics', 'People behind the electoral map', 'Compare population, voter registration, PVC collection, and geographic distribution across Nigeria.'],
    elections: ['Nigeria · Election archive', 'Elections', 'Browse available election cycles, types, dates, declared winners, and source status.'],
    results: ['Nigeria · Declared results', 'Election results', 'Review the latest available declared result, candidate totals, and supporting sources.'],
    candidates: ['Nigeria · Candidate directory', 'Candidates', 'Explore candidates recorded in the currently selected election archive.'],
    parties: ['Nigeria · Political organisations', 'Parties', 'Compare party participation and recorded vote totals in the selected result.'],
    analysis: ['Nigeria · Electoral analysis', 'Analysis', 'Read participation, ballot accounting, PVC collection, and demographic context together.'],
    data: ['Nigeria · Data catalogue', 'Data', 'Understand the local datasets, geographic coverage, update state, and methodology behind this dashboard.']
  };
  const model = { population: null, polling: null, results: null, map: null, boundaryLayer: null, selectedLayer: null, stateRows: [], activeSection: 'overview' };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function formatNumber(value, compact = false) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat('en-NG', compact ? { notation: 'compact', maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }).format(number);
  }

  function formatPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(1)}%` : '—';
  }

  function formatDate(value) {
    if (!value) return 'Date unavailable';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function applyTheme(theme) {
    const isLight = theme === 'light';
    body.classList.toggle('theme-light', isLight);
    body.classList.toggle('theme-dark', !isLight);
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    themeButton?.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    themeButton?.setAttribute('aria-pressed', String(isLight));
    if (model.map) window.setTimeout(() => model.map.invalidateSize(), 40);
    const populationFrame = document.getElementById('intel-population-frame');
    populationFrame?.contentWindow?.postMessage({ type: 'geointel-theme', theme: isLight ? 'light' : 'dark' }, window.location.origin);
  }

  function showSection(section) {
    if (!sectionMeta[section]) return;
    model.activeSection = section;
    navigationButtons.forEach((button) => {
      const active = button.dataset.intelSection === section;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    views.forEach((view) => view.classList.toggle('is-active', view.dataset.intelView === section));
    const [kicker, title, description] = sectionMeta[section];
    document.getElementById('intel-kicker').textContent = kicker;
    document.getElementById('intel-page-title').textContent = title;
    document.getElementById('intel-page-description').textContent = description;
    body.classList.remove('intel-mobile-nav-open');
    if (section === 'overview' && model.map) window.setTimeout(() => model.map.invalidateSize(), 80);
    if (section === 'population') {
      const populationFrame = document.getElementById('intel-population-frame');
      window.setTimeout(() => populationFrame?.contentWindow?.postMessage({ type: 'geointel-resize' }, window.location.origin), 120);
    }
    history.replaceState(null, '', `${window.location.pathname}?country=NG&section=${section}`);
  }

  function kpiCard(label, value, note, icon, tone = 'teal') {
    return `<article class="intel-kpi intel-kpi-${tone}"><div><span>${icon}</span><small>${escapeHtml(label)}</small></div><strong>${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></article>`;
  }

  function getNationalPopulation() {
    return model.population?.statePopulation?.find((row) => String(row.state).toLowerCase() === 'total') || {};
  }

  function renderKpis() {
    const total = getNationalPopulation();
    const polling = model.polling?.summary || {};
    const latest = model.results?.latest || {};
    const resultTotals = latest.totals || {};
    document.getElementById('intel-kpi-grid').innerHTML = [
      kpiCard('Population', formatNumber(total.population, true), 'National dataset estimate', '◉', 'blue'),
      kpiCard('Registered voters', formatNumber(total.registeredVoters, true), 'Across 36 states and FCT', '▣', 'teal'),
      kpiCard('PVCs collected', formatNumber(total.collectedPVCs, true), `${formatPercent(total.pvcCollectionRate)} collection rate`, '✓', 'green'),
      kpiCard('Polling units', formatNumber(polling.totalPollingUnits), `${formatNumber(polling.totalWards)} wards represented`, '⌖', 'violet'),
      kpiCard('Latest valid votes', formatNumber(resultTotals.validVotes), latest.state ? `${latest.state} archive` : 'Result archive', '▥', 'amber')
    ].join('');
  }

  function emptyActivity(message) {
    return `<div class="intel-activity-empty"><span>—</span><p>${escapeHtml(message)}</p></div>`;
  }

  function resultActivity(result) {
    if (!result) return '';
    return `<button class="intel-result-activity" type="button" data-open-results><span><b>${escapeHtml(result.state || 'Nigeria')}</b><small>${escapeHtml(result.election || 'Election result')}</small></span><strong>${escapeHtml(result.winner?.party || '—')}</strong><em>${formatDate(result.declaredDate || result.electionDate)}</em></button>`;
  }

  function renderActivity() {
    const latest = model.results?.latest;
    const historyRows = model.results?.history || [];
    document.getElementById('intel-live-list').innerHTML = emptyActivity('No verified live election feed is connected right now.');
    document.getElementById('intel-upcoming-list').innerHTML = emptyActivity('No verified upcoming schedule is connected yet.');
    document.getElementById('intel-recent-list').innerHTML = [latest, ...historyRows.slice(0, 2)].map(resultActivity).join('') || emptyActivity('No recent result is available.');
    document.querySelectorAll('[data-open-results]').forEach((button) => button.addEventListener('click', () => showSection('results')));
  }

  function stateKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace('federalcapitalterritory', 'fctabuja').replace(/^fct$/, 'fctabuja');
  }

  function featureStateName(feature) {
    const properties = feature?.properties || {};
    return properties.NAME_1 || properties.name_1 || properties.NAME || properties.name || 'State';
  }

  function populationColor(value) {
    const number = Number(value || 0);
    if (number >= 7000000) return '#168f8a';
    if (number >= 4500000) return '#2b8197';
    if (number >= 3000000) return '#356d8f';
    return '#405c7b';
  }

  function updateMapSelection(stateName, fit = false) {
    const isNational = !stateName || stateName === 'all';
    const row = isNational ? getNationalPopulation() : model.stateRows.find((item) => stateKey(item.state) === stateKey(stateName));
    const label = isNational ? 'Nigeria' : (row?.state || stateName);
    document.getElementById('intel-map-breadcrumb').textContent = `Nigeria / ${isNational ? 'All states' : label}`;
    document.getElementById('intel-map-selection').innerHTML = `<p>Selected geography</p><strong>${escapeHtml(label)}</strong><span>${isNational ? 'Choose a state on the map to drill down.' : `${formatNumber(row?.population)} people · ${formatNumber(row?.registeredVoters)} registered voters · ${formatPercent(row?.pvcCollectionRate)} PVC rate`}</span>`;
    if (stateFilter.value !== (isNational ? 'all' : label)) stateFilter.value = isNational ? 'all' : label;
    if (model.selectedLayer) {
      model.boundaryLayer.resetStyle(model.selectedLayer);
      model.selectedLayer = null;
    }
    if (isNational) {
      if (fit && model.boundaryLayer) model.map.fitBounds(model.boundaryLayer.getBounds(), { padding: [18, 18] });
      return;
    }
    model.boundaryLayer?.eachLayer((layer) => {
      if (stateKey(featureStateName(layer.feature)) !== stateKey(label)) return;
      model.selectedLayer = layer;
      layer.setStyle({ weight: 2.5, color: '#f5c45a', fillOpacity: 0.96 });
      layer.bringToFront();
      if (fit) model.map.fitBounds(layer.getBounds(), { padding: [28, 28], maxZoom: 8 });
    });
  }

  async function initializeMap() {
    const mapElement = document.getElementById('intel-election-map');
    model.map = L.map(mapElement, { zoomControl: true, scrollWheelZoom: false, attributionControl: false, preferCanvas: true }).setView([9.08, 8.68], 6);
    const response = await fetch('data/boundaries/adm1.zip');
    if (!response.ok) throw new Error('Nigeria state boundaries could not be loaded.');
    let boundaries = await shp(await response.arrayBuffer());
    if (Array.isArray(boundaries)) boundaries = boundaries.find((item) => item?.features?.length) || boundaries[0];
    model.boundaryLayer = L.geoJSON(boundaries, {
      filter: (feature) => stateKey(featureStateName(feature)) !== 'waterbody',
      style: (feature) => {
        const row = model.stateRows.find((item) => stateKey(item.state) === stateKey(featureStateName(feature)));
        return { color: 'rgba(191,214,226,.7)', weight: 0.8, fillColor: populationColor(row?.population), fillOpacity: 0.88 };
      },
      onEachFeature: (feature, layer) => {
        const name = featureStateName(feature);
        const row = model.stateRows.find((item) => stateKey(item.state) === stateKey(name));
        layer.bindTooltip(`<strong>${escapeHtml(name)}</strong><br>${formatNumber(row?.population)} people`, { sticky: true, className: 'intel-map-tooltip' });
        layer.on({
          click: () => updateMapSelection(name, true),
          mouseover: () => { if (layer !== model.selectedLayer) layer.setStyle({ weight: 1.6, color: '#ffffff', fillOpacity: 1 }); },
          mouseout: () => { if (layer !== model.selectedLayer) model.boundaryLayer.resetStyle(layer); }
        });
      }
    }).addTo(model.map);
    model.map.fitBounds(model.boundaryLayer.getBounds(), { padding: [18, 18] });
  }

  function renderPopulation() {
    const total = getNationalPopulation();
    const polling = model.polling?.summary || {};
    document.getElementById('intel-population-kpis').innerHTML = [
      kpiCard('Total population', formatNumber(total.population), 'National dataset estimate', '◉', 'blue'),
      kpiCard('Registered voters', formatNumber(total.registeredVoters), `${formatPercent((total.registeredVoters / total.population) * 100)} of population`, '▣', 'teal'),
      kpiCard('Collected PVCs', formatNumber(total.collectedPVCs), `${formatPercent(total.pvcCollectionRate)} collection rate`, '✓', 'green'),
      kpiCard('Population per polling unit', formatNumber(polling.nationalPopulationPerPollingUnit), 'National service pressure', '⌖', 'amber')
    ].join('');
  }

  function availableElections() {
    const rows = [model.results?.latest, ...(model.results?.history || [])].filter(Boolean);
    return rows.filter((row) => {
      const matchesYear = yearFilter.value === 'all' || String(row.electionDate || '').startsWith(yearFilter.value);
      const matchesType = typeFilter.value === 'all' || String(row.election || '').toLowerCase().includes(typeFilter.value.toLowerCase());
      const matchesStatus = statusFilter.value === 'all' || statusFilter.value === 'completed';
      return matchesYear && matchesType && matchesStatus;
    });
  }

  function renderElections() {
    const elections = availableElections();
    document.getElementById('intel-election-list').innerHTML = elections.length ? elections.map((row) => `<button type="button" data-open-results><span class="intel-election-date"><b>${new Date(`${row.electionDate}T00:00:00`).getFullYear()}</b><small>${formatDate(row.electionDate)}</small></span><span><strong>${escapeHtml(row.election)}</strong><small>${escapeHtml(row.state)} · Governorship · Completed</small></span><span class="intel-election-winner"><small>Declared winner</small><b>${escapeHtml(row.winner?.name || '—')}</b><em>${escapeHtml(row.winner?.party || '—')}</em></span><i>›</i></button>`).join('') : `<div class="intel-large-empty"><b>No matching election archive</b><span>Change the year, election type, or status filter to see available records.</span></div>`;
    document.querySelectorAll('#intel-election-list [data-open-results]').forEach((button) => button.addEventListener('click', () => showSection('results')));
  }

  function candidateColor(party) {
    return ({ APC: '#55a8ff', PDP: '#eb6373', LP: '#43c98a', ADC: '#f1a24d', SDP: '#9f75e5', NNPP: '#d35eb2' })[party] || '#78869a';
  }

  function renderResults() {
    const result = model.results?.latest;
    if (!result) return;
    const totals = result.totals || {};
    document.getElementById('intel-result-summary').innerHTML = `<article class="intel-winner-panel"><span>Declared result</span><div><small>${escapeHtml(result.election)}</small><h2>${escapeHtml(result.winner?.name || '—')}</h2><p>${escapeHtml(result.winner?.party || '—')} · ${formatNumber(result.winner?.votes)} votes</p></div><dl><div><dt>Valid votes</dt><dd>${formatNumber(totals.validVotes)}</dd></div><div><dt>Accredited</dt><dd>${formatNumber(totals.accreditedVoters)}</dd></div><div><dt>Rejected</dt><dd>${formatNumber(totals.rejectedVotes)}</dd></div><div><dt>LGAs won</dt><dd>${formatNumber(totals.lgAsWon)}</dd></div></dl></article>`;
    const candidates = result.candidates || [];
    const maxVotes = Math.max(...candidates.map((candidate) => Number(candidate.votes || 0)), 1);
    document.getElementById('intel-result-bars').innerHTML = candidates.slice(0, 10).map((candidate) => `<div class="intel-bar-row"><div><b>${escapeHtml(candidate.name)}</b><span>${escapeHtml(candidate.party)} · ${formatNumber(candidate.votes)}</span></div><i><em style="width:${Math.max(1, (Number(candidate.votes) / maxVotes) * 100)}%;background:${candidateColor(candidate.party)}"></em></i></div>`).join('');
    document.getElementById('intel-result-sources').innerHTML = (result.sources || []).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><span>↗</span><div><b>${escapeHtml(source.publisher)}</b><small>${escapeHtml(source.title)}</small></div></a>`).join('');
  }

  function renderCandidatesAndParties() {
    const candidates = model.results?.latest?.candidates || [];
    document.getElementById('intel-candidate-grid').innerHTML = candidates.map((candidate) => `<article class="intel-person-card" style="--party:${candidateColor(candidate.party)}"><span>${escapeHtml(candidate.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span><div><h2>${escapeHtml(candidate.name)}</h2><p>${escapeHtml(candidate.party)} candidate</p><strong>${formatNumber(candidate.votes)} votes</strong></div></article>`).join('');
    const parties = Object.values(candidates.reduce((accumulator, candidate) => {
      const party = candidate.party || 'Other';
      accumulator[party] ||= { party, candidates: 0, votes: 0 };
      accumulator[party].candidates += 1;
      accumulator[party].votes += Number(candidate.votes || 0);
      return accumulator;
    }, {})).sort((a, b) => b.votes - a.votes);
    document.getElementById('intel-party-grid').innerHTML = parties.map((party) => `<article class="intel-party-card" style="--party:${candidateColor(party.party)}"><i></i><span>${escapeHtml(party.party)}</span><div><h2>${escapeHtml(party.party)}</h2><p>${party.candidates} recorded candidate${party.candidates === 1 ? '' : 's'}</p><strong>${formatNumber(party.votes)} votes</strong></div></article>`).join('');
  }

  function renderAnalysis() {
    const result = model.results?.latest || {};
    const totals = result.totals || {};
    const totalBallots = Number(totals.validVotes || 0) + Number(totals.rejectedVotes || 0);
    const rejectionRate = totalBallots ? (Number(totals.rejectedVotes) / totalBallots) * 100 : 0;
    const validRate = totalBallots ? (Number(totals.validVotes) / totalBallots) * 100 : 0;
    document.getElementById('intel-analysis-kpis').innerHTML = [
      kpiCard('Accredited voters', formatNumber(totals.accreditedVoters), result.state || 'Selected election', '▣', 'blue'),
      kpiCard('Valid ballot rate', formatPercent(validRate), 'Of accounted ballots', '✓', 'green'),
      kpiCard('Rejected ballot rate', formatPercent(rejectionRate), 'Of accounted ballots', '!', 'amber'),
      kpiCard('Winning vote share', formatPercent(totals.validVotes ? (Number(result.winner?.votes || 0) / Number(totals.validVotes)) * 100 : 0), result.winner?.party || 'Winner', '◇', 'violet')
    ].join('');
    const accounting = [
      { name: 'Accredited voters', value: Number(totals.accreditedVoters || 0) },
      { name: 'Valid votes', value: Number(totals.validVotes || 0) },
      { name: 'Rejected votes', value: Number(totals.rejectedVotes || 0) }
    ];
    const maxAccounting = Math.max(...accounting.map((row) => row.value), 1);
    document.getElementById('intel-analysis-bars').innerHTML = accounting.map((row) => `<div class="intel-bar-row"><div><b>${row.name}</b><span>${formatNumber(row.value)}</span></div><i><em style="width:${Math.max(2, (row.value / maxAccounting) * 100)}%"></em></i></div>`).join('');
    const pvcRows = [...model.stateRows].sort((a, b) => Number(b.pvcCollectionRate) - Number(a.pvcCollectionRate)).slice(0, 10);
    document.getElementById('intel-pvc-bars').innerHTML = pvcRows.map((row) => `<div class="intel-bar-row"><div><b>${escapeHtml(row.state)}</b><span>${formatPercent(row.pvcCollectionRate)}</span></div><i><em style="width:${Number(row.pvcCollectionRate)}%"></em></i></div>`).join('');
  }

  function renderDataCatalogue() {
    const generated = model.population?.generatedAt ? formatDate(String(model.population.generatedAt).slice(0, 10)) : 'Local dataset';
    const cards = [
      ['Population & PVC', 'JSON', '36 states + FCT', generated, 'Population estimates, registered voters, collected PVCs, governors, and LGA population records.', 'population.html'],
      ['Polling units', 'CSV / GeoJSON', `${formatNumber(model.polling?.summary?.totalPollingUnits)} locations`, 'Local API', 'Polling-unit coverage, ward totals, LGA pressure metrics, and geographic point data.', 'polling-units.html'],
      ['Administrative boundaries', 'Shapefile', 'National / state / LGA', 'Local assets', 'Nigeria administrative boundaries used for geographic selection and drill-down.', 'data/boundaries/adm1.zip'],
      ['Election results', 'JSON API', 'Available state archive', 'Source-linked', 'Declared winners, candidate totals, ballot accounting, election history, and publication sources.', 'election-results.html']
    ];
    document.getElementById('intel-data-grid').innerHTML = cards.map(([name, format, coverage, updated, description, href]) => `<article class="intel-data-card"><span>▤</span><div><small>${escapeHtml(format)} · ${escapeHtml(coverage)}</small><h2>${escapeHtml(name)}</h2><p>${escapeHtml(description)}</p><footer><em>${escapeHtml(updated)}</em><a href="${escapeHtml(href)}">Open ↗</a></footer></div></article>`).join('');
  }

  function populateStateFilter() {
    stateFilter.insertAdjacentHTML('beforeend', [...model.stateRows].sort((a, b) => String(a.state).localeCompare(String(b.state))).map((row) => `<option value="${escapeHtml(row.state)}">${escapeHtml(row.state)}</option>`).join(''));
  }

  async function initialize() {
    const requestedCountry = (pageParameters.get('country') || 'NG').toUpperCase();
    if (requestedCountry !== 'NG') {
      const notice = document.getElementById('intel-country-notice');
      notice.hidden = false;
      notice.innerHTML = `<strong>Nigeria workspace shown.</strong> Detailed data for ${escapeHtml(requestedCountry)} has not been connected yet.`;
    }
    try {
      const populationRequest = fetch('/api/population-data').then((response) => { if (!response.ok) throw new Error('Population data failed to load.'); return response.json(); });
      const pollingRequest = fetch('/api/polling-units-data').then((response) => { if (!response.ok) throw new Error('Polling-unit data failed to load.'); return response.json(); });
      const resultsRequest = fetch('/api/election-results').then((response) => { if (!response.ok) throw new Error('Election results failed to load.'); return response.json(); });
      const [population, polling] = await Promise.all([populationRequest, pollingRequest]);
      model.population = population;
      model.polling = polling;
      model.stateRows = (population.statePopulation || []).filter((row) => String(row.state).toLowerCase() !== 'total');
      populateStateFilter();
      renderKpis();
      renderActivity();
      renderPopulation();
      renderElections();
      renderDataCatalogue();
      await initializeMap();
      try {
        model.results = await resultsRequest;
        renderKpis();
        renderActivity();
        renderElections();
        renderResults();
        renderCandidatesAndParties();
        renderAnalysis();
        renderDataCatalogue();
      } catch (resultsError) {
        const notice = document.getElementById('intel-country-notice');
        notice.hidden = false;
        notice.innerHTML = `<strong>Population and map data are available.</strong> ${escapeHtml(resultsError.message)}`;
      }
    } catch (error) {
      const notice = document.getElementById('intel-country-notice');
      notice.hidden = false;
      notice.innerHTML = `<strong>Dashboard data could not be fully loaded.</strong> ${escapeHtml(error.message)}`;
      console.error(error);
    }
  }

  const requestedTheme = pageParameters.get('theme');
  applyTheme(requestedTheme === 'light' || requestedTheme === 'dark' ? requestedTheme : (localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'));
  themeButton?.addEventListener('click', () => applyTheme(body.classList.contains('theme-light') ? 'dark' : 'light'));
  document.getElementById('intel-population-frame')?.addEventListener('load', () => {
    const theme = body.classList.contains('theme-light') ? 'light' : 'dark';
    document.getElementById('intel-population-frame')?.contentWindow?.postMessage({ type: 'geointel-theme', theme }, window.location.origin);
  });
  navigationButtons.forEach((button) => button.addEventListener('click', () => showSection(button.dataset.intelSection)));
  document.querySelector('[data-intel-mobile-nav]')?.addEventListener('click', () => body.classList.toggle('intel-mobile-nav-open'));
  stateFilter.addEventListener('change', () => updateMapSelection(stateFilter.value, true));
  [yearFilter, typeFilter, statusFilter].forEach((filter) => filter.addEventListener('change', renderElections));
  document.getElementById('intel-reset-map').addEventListener('click', () => updateMapSelection('all', true));
  document.getElementById('intel-reset-filters').addEventListener('click', () => {
    stateFilter.value = 'all'; yearFilter.value = 'all'; typeFilter.value = 'all'; statusFilter.value = 'all';
    updateMapSelection('all', true); renderElections();
  });
  showSection(pageParameters.get('section') || 'overview');
  initialize();
})();
