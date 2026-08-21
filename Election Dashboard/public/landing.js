(function () {
  const STORAGE_KEY = 'electionDashboardTheme';
  const body = document.body;
  const themeButton = document.querySelector('[data-landing-theme]');
  const menuButton = document.querySelector('.landing-menu-toggle');
  const navigation = document.querySelector('.landing-nav');
  const year = document.getElementById('landing-year');
  const tvCarousel = document.querySelector('[data-tv-carousel]');

  function applyTheme(theme) {
    const isLight = theme === 'light';
    body.classList.toggle('theme-light', isLight);
    body.classList.toggle('theme-dark', !isLight);
    localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
    if (themeButton) {
      themeButton.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
      themeButton.setAttribute('aria-pressed', String(isLight));
    }
  }

  const requestedTheme = new URLSearchParams(window.location.search).get('theme');
  const initialTheme = requestedTheme === 'light' || requestedTheme === 'dark'
    ? requestedTheme
    : (localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark');
  applyTheme(initialTheme);
  themeButton?.addEventListener('click', () => applyTheme(body.classList.contains('theme-light') ? 'dark' : 'light'));
  menuButton?.addEventListener('click', () => {
    const isOpen = body.classList.toggle('landing-menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  navigation?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      body.classList.remove('landing-menu-open');
      menuButton?.setAttribute('aria-expanded', 'false');
    }
  });

  function initializeTvCarousel(carousel) {
    const track = carousel.querySelector('.tv-track');
    const slides = Array.from(carousel.querySelectorAll('.tv-slide'));
    const dots = Array.from(carousel.querySelectorAll('[data-tv-dot]'));
    const previousButton = carousel.querySelector('[data-tv-prev]');
    const nextButton = carousel.querySelector('[data-tv-next]');
    const status = carousel.querySelector('.tv-channel-status');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let activeIndex = 0;
    let pointerStartX = null;
    let autoplayTimer = null;

    if (!track || slides.length < 2) {
      return;
    }

    function showSlide(index) {
      activeIndex = (index + slides.length) % slides.length;
      track.style.transform = `translateX(-${activeIndex * 100}%)`;

      slides.forEach((slide, slideIndex) => {
        const isActive = slideIndex === activeIndex;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
      });

      dots.forEach((dot, dotIndex) => {
        const isActive = dotIndex === activeIndex;
        dot.classList.toggle('is-active', isActive);
        if (isActive) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });

      if (status) {
        status.textContent = slides[activeIndex].dataset.tvTitle || `Screen ${activeIndex + 1}`;
      }
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        window.clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();
      if (!reduceMotion && !document.hidden) {
        autoplayTimer = window.setInterval(() => showSlide(activeIndex + 1), 8500);
      }
    }

    function selectManually(index) {
      showSlide(index);
      startAutoplay();
    }

    previousButton?.addEventListener('click', () => selectManually(activeIndex - 1));
    nextButton?.addEventListener('click', () => selectManually(activeIndex + 1));
    dots.forEach((dot, index) => dot.addEventListener('click', () => selectManually(index)));

    carousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        selectManually(activeIndex - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        selectManually(activeIndex + 1);
      }
    });

    carousel.addEventListener('pointerdown', (event) => {
      if (event.target.closest('a, button')) {
        return;
      }
      pointerStartX = event.clientX;
      stopAutoplay();
      carousel.setPointerCapture?.(event.pointerId);
    });

    carousel.addEventListener('pointerup', (event) => {
      if (pointerStartX === null) {
        return;
      }
      const distance = event.clientX - pointerStartX;
      pointerStartX = null;
      if (Math.abs(distance) >= 45) {
        showSlide(activeIndex + (distance < 0 ? 1 : -1));
      }
      startAutoplay();
    });

    carousel.addEventListener('pointercancel', () => {
      pointerStartX = null;
      startAutoplay();
    });
    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    carousel.addEventListener('focusin', stopAutoplay);
    carousel.addEventListener('focusout', (event) => {
      if (!carousel.contains(event.relatedTarget)) {
        startAutoplay();
      }
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? stopAutoplay() : startAutoplay()));

    showSlide(0);
    startAutoplay();
  }

  if (tvCarousel) {
    initializeTvCarousel(tvCarousel);
  }

  if (year) year.textContent = String(new Date().getFullYear());
})();
