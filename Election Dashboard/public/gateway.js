(function () {
  const STORAGE_KEY = 'electionDashboardTheme';
  const pageParameters = new URLSearchParams(window.location.search);
  const countries = [
    { code: 'NG', name: 'Nigeria', region: 'West Africa', election: 'Election monitoring demo', elections: 9, status: 'live', detail: 'Preview only', accent: '#16a56f', preview: true },
    { code: 'US', name: 'United States', region: 'North America', election: 'Federal elections', elections: 12, status: 'upcoming', detail: 'Upcoming cycle', accent: '#5c50a1' },
    { code: 'GB', name: 'United Kingdom', region: 'Northern Europe', election: 'Parliamentary elections', elections: 8, status: 'recent', detail: 'Recent result archive', accent: '#16469c' },
    { code: 'GH', name: 'Ghana', region: 'West Africa', election: 'Presidential elections', elections: 6, status: 'recent', detail: 'Recent result archive', accent: '#f31846' },
    { code: 'KE', name: 'Kenya', region: 'East Africa', election: 'General elections', elections: 5, status: 'upcoming', detail: 'Upcoming cycle', accent: '#087c21' },
    { code: 'IN', name: 'India', region: 'South Asia', election: 'Lok Sabha elections', elections: 7, status: 'recent', detail: 'Recent result archive', accent: '#ff962d' },
    { code: 'DE', name: 'Germany', region: 'Central Europe', election: 'Federal elections', elections: 6, status: 'recent', detail: 'Recent result archive', accent: '#ed1536' },
    { code: 'FR', name: 'France', region: 'Western Europe', election: 'Presidential elections', elections: 6, status: 'upcoming', detail: 'Upcoming cycle', accent: '#0666ab' },
    { code: 'BR', name: 'Brazil', region: 'South America', election: 'General elections', elections: 7, status: 'upcoming', detail: 'Upcoming cycle', accent: '#19a65a' },
    { code: 'ZA', name: 'South Africa', region: 'Southern Africa', election: 'General elections', elections: 6, status: 'recent', detail: 'Recent result archive', accent: '#138568' }
  ];

  const body = document.body;
  body.classList.toggle('gateway-tv-preview', pageParameters.get('preview') === 'tv');
  const themeButton = document.querySelector('[data-gateway-theme]');
  const searchInput = document.getElementById('gateway-search-input');
  const countryGrid = document.getElementById('gateway-country-grid');
  const emptyState = document.getElementById('gateway-empty');
  const resultSummary = document.getElementById('gateway-results-summary');
  const filterButtons = Array.from(document.querySelectorAll('[data-status-filter]'));
  let activeStatus = 'all';

  function applyTheme(theme) {
    const isLight = theme === 'light';
    body.classList.toggle('theme-light', isLight);
    body.classList.toggle('theme-dark', !isLight);
    localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
    themeButton?.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    themeButton?.setAttribute('aria-pressed', String(isLight));
  }

  function statusLabel(status, isPreview) {
    if (status === 'live' && isPreview) return 'Live preview';
    return status === 'live' ? 'Live now' : status === 'upcoming' ? 'Upcoming' : 'Recent result';
  }

  function countryCard(country) {
    const query = new URLSearchParams({ country: country.code, name: country.name });
    return `
      <a class="gateway-country-card" href="dashboard.html?${query.toString()}" style="--country-accent:${country.accent}">
        <div class="country-card-main">
          <span class="country-flag"><img src="assets/flags/${country.code.toLowerCase()}.png" alt="${country.name} flag" /></span>
          <div class="country-card-copy">
            <h3>${country.name}</h3>
            <p>${country.region}</p>
          </div>
        </div>
        <div class="country-card-status">
          <span class="gateway-status status-${country.status}"><i></i>${statusLabel(country.status, country.preview)}</span>
          <span>${country.elections} elections</span>
        </div>
        <i class="country-accent-line" aria-hidden="true"></i>
      </a>`;
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = countries.filter((country) => {
      const matchesStatus = activeStatus === 'all' || country.status === activeStatus;
      const searchText = `${country.name} ${country.code} ${country.region} ${country.election} ${country.detail}`.toLowerCase();
      return matchesStatus && (!query || searchText.includes(query));
    });

    countryGrid.innerHTML = filtered.map(countryCard).join('');
    countryGrid.hidden = filtered.length === 0;
    emptyState.hidden = filtered.length !== 0;
    const noun = filtered.length === 1 ? 'country' : 'countries';
    resultSummary.textContent = `${filtered.length} ${noun} shown${activeStatus === 'all' ? '' : ` · ${statusLabel(activeStatus)}`}`;
  }

  function updateCounts() {
    document.querySelector('[data-filter-count="all"]').textContent = String(countries.length);
    ['live', 'upcoming', 'recent'].forEach((status) => {
      document.querySelector(`[data-filter-count="${status}"]`).textContent = String(countries.filter((country) => country.status === status).length);
    });
  }

  const requestedTheme = pageParameters.get('theme');
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  applyTheme(requestedTheme === 'light' || requestedTheme === 'dark' ? requestedTheme : (savedTheme === 'light' ? 'light' : 'dark'));

  themeButton?.addEventListener('click', () => applyTheme(body.classList.contains('theme-light') ? 'dark' : 'light'));
  searchInput.addEventListener('input', render);
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeStatus = button.dataset.statusFilter;
      filterButtons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      render();
    });
  });
  document.querySelector('[data-clear-search]')?.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    render();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      searchInput.blur();
      render();
    }
  });

  updateCounts();
  render();
})();
