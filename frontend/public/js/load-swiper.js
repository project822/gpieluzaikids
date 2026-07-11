(function () {
  'use strict';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadSwiper() {
    if (window.Swiper) return Promise.resolve();

    // CSS
    const existingCss = document.querySelector('link[data-swiper-css="true"]');
    if (!existingCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
      link.setAttribute('data-swiper-css', 'true');
      document.head.appendChild(link);
    }

    // JS
    return loadScript('https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js');
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(() => {
    loadSwiper()
      .then(() => {
        if (window.Swiper && typeof window.initSwiperForPage === 'function') {
          window.initSwiperForPage();
        }
      })
      .catch((e) => console.error('[swiper] load failed', e));
  });
})();


