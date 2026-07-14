const numberFormat = new Intl.NumberFormat('en-NG');
const results = {
  date: document.getElementById('resultDate'), winner: document.getElementById('winnerHeading'),
  party: document.getElementById('winnerParty'), votes: document.getElementById('winnerVotes'),
  lgas: document.getElementById('lgasWon'), accredited: document.getElementById('accreditedVoters'),
  valid: document.getElementById('validVotes'), rejected: document.getElementById('rejectedVotes'),
  candidates: document.getElementById('candidateResults'), count: document.getElementById('candidateCount'),
  sources: document.getElementById('resultSources'), news: document.getElementById('newsFeed'), refresh: document.getElementById('refreshResultsButton'),
};
const stateDetails = document.getElementById('stateMapDetails');
const resetMapButton = document.getElementById('resetElectionMap');
let currentResult = null;
let electionMap = null;
let electionLayer = null;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function render(data) {
  currentResult = data;
  const winner = data.winner;
  const candidates = [...data.candidates].sort((a, b) => b.votes - a.votes);
  const maxVotes = candidates[0]?.votes || 1;
  results.date.textContent = `Election held ${new Date(`${data.electionDate}T12:00:00`).toLocaleDateString('en-NG', { dateStyle: 'long' })} • Declared ${new Date(`${data.declaredDate}T12:00:00`).toLocaleDateString('en-NG', { dateStyle: 'long' })}`;
  results.winner.textContent = winner.name;
  results.party.textContent = `${winner.party} — All Progressives Congress`;
  results.votes.textContent = numberFormat.format(winner.votes);
  results.lgas.textContent = `${data.totals.lgAsWon} of 16`;
  results.accredited.textContent = numberFormat.format(data.totals.accreditedVoters);
  results.valid.textContent = numberFormat.format(data.totals.validVotes);
  results.rejected.textContent = numberFormat.format(data.totals.rejectedVotes);
  results.count.textContent = `${candidates.length} candidates`;
  results.candidates.innerHTML = candidates.map((candidate, index) => `
    <div class="candidate-row ${index === 0 ? 'is-winner' : ''}">
      <span class="candidate-rank">${index + 1}</span>
      <div class="candidate-info"><strong>${escapeHtml(candidate.name)}</strong><span>${escapeHtml(candidate.party)}</span><div class="vote-bar"><i style="width:${Math.max(1.5, candidate.votes / maxVotes * 100)}%"></i></div></div>
      <strong class="candidate-votes">${numberFormat.format(candidate.votes)}</strong>
    </div>`).join('');
  results.sources.innerHTML = data.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(source.publisher)}</strong><span>${escapeHtml(source.title)}</span><b>Read source ↗</b></a>`).join('');
  results.news.innerHTML = data.news?.length
    ? data.news.map((article) => `<a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(article.source || 'News source')}</span></a>`).join('')
    : '<p class="loading-copy">No fresh headlines returned right now. The verified result sources above remain available.</p>';
}

function stateKey(value) { return String(value || '').trim().toLowerCase().replace(/\s+state$/, ''); }

function showStateDetails(stateName) {
  const completed = currentResult && stateKey(stateName) === stateKey(currentResult.state);
  if (!completed) {
    stateDetails.innerHTML = `<p class="page-kicker">Selected state</p><h3>${escapeHtml(stateName)}</h3><span class="state-status pending">Election not yet held</span><p>No declared result is available for this state on the latest-results page.</p>`;
    return;
  }
  stateDetails.innerHTML = `<p class="page-kicker">Declared result</p><h3>${escapeHtml(currentResult.election)}</h3><span class="state-status completed">Election completed</span><p><strong>${escapeHtml(currentResult.winner.name)}</strong> (${escapeHtml(currentResult.winner.party)}) won with <strong>${numberFormat.format(currentResult.winner.votes)}</strong> votes.</p><button id="viewStateResult" type="button">View full result details</button>`;
  document.getElementById('viewStateResult').addEventListener('click', () => document.getElementById('resultDetails').scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

async function initialiseElectionMap() {
  try {
    const response = await fetch('data/boundaries/adm1.zip');
    if (!response.ok) throw new Error('State boundaries could not be loaded.');
    const boundaryData = await shp(await response.arrayBuffer());
    electionMap = L.map('electionResultsMap', { scrollWheelZoom: false, preferCanvas: true }).setView([9.08, 8.68], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(electionMap);
    const isCompleted = (feature) => stateKey(feature.properties?.NAME_1) === stateKey(currentResult?.state);
    electionLayer = L.geoJSON(boundaryData, {
      filter: (feature) => stateKey(feature.properties?.NAME_1) !== 'water body',
      style: (feature) => ({ color: '#294857', weight: 1.2, fillColor: isCompleted(feature) ? '#25a96d' : '#9baeb7', fillOpacity: .82 }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.NAME_1 || 'State';
        const done = isCompleted(feature);
        layer.bindTooltip(`${name}: ${done ? 'Election completed' : 'Not yet held'}`, { sticky: true });
        layer.on({ click: () => { showStateDetails(name); layer.setStyle({ weight: 3, color: '#f6c453' }); electionMap.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 8 }); }, mouseover: () => layer.setStyle({ weight: 2, fillOpacity: 1 }), mouseout: () => electionLayer.resetStyle(layer) });
      },
    }).addTo(electionMap);
    electionMap.fitBounds(electionLayer.getBounds(), { padding: [12, 12] });
    resetMapButton.addEventListener('click', () => {
      electionMap.fitBounds(electionLayer.getBounds(), { padding: [12, 12] });
      showStateDetails(currentResult?.state || 'Ekiti');
    });
    window.requestAnimationFrame(() => electionMap.invalidateSize());
    showStateDetails(currentResult?.state || 'Ekiti');
  } catch (error) { stateDetails.innerHTML = `<p class="page-kicker">Map unavailable</p><h3>Unable to load state boundaries</h3><p>${escapeHtml(error.message)}</p>`; }
}

async function loadResults() {
  results.refresh.disabled = true;
  results.refresh.textContent = 'Refreshing…';
  try {
    const response = await fetch('/api/election-results/ekiti', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load election results.');
    render(await response.json());
    if (!electionMap) initialiseElectionMap();
  } catch (error) {
    results.date.textContent = error.message;
    results.news.innerHTML = '<p class="loading-copy">The live news service is currently unavailable. Please refresh to try again.</p>';
  } finally {
    results.refresh.disabled = false;
    results.refresh.textContent = 'Refresh results';
  }
}

results.refresh.addEventListener('click', loadResults);
loadResults();
