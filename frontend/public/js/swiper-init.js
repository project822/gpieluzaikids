// Minimal swiper init (tanpa mengubah function lain)
// Catatan: file ini akan dipakai bila Swiper tersedia.

(function () {
  'use strict';

  function initSwiper() {
    if (!window.Swiper) return;

    // Events
    const eventsEl = document.querySelector('#events .events-swiper');
    if (eventsEl) {
      // eslint-disable-next-line no-undef
      new window.Swiper(eventsEl, {
        slidesPerView: 1,
        spaceBetween: 16,
        navigation: {
          nextEl: '#events .swiper-button-next',
          prevEl: '#events .swiper-button-prev',
        },
        pagination: {
          el: '#events .swiper-pagination',
          clickable: true,
        },
        breakpoints: {
          640: { slidesPerView: 2 },
          980: { slidesPerView: 3 },
        },
      });
    }

    // Documentation
    const docsEl = document.querySelector('#documentation .docs-swiper');
    if (docsEl) {
      // eslint-disable-next-line no-undef
      new window.Swiper(docsEl, {
        slidesPerView: 1,
        spaceBetween: 16,
        navigation: {
          nextEl: '#documentation .swiper-button-next',
          prevEl: '#documentation .swiper-button-prev',
        },
        pagination: {
          el: '#documentation .swiper-pagination',
          clickable: true,
        },
        breakpoints: {
          640: { slidesPerView: 2 },
          980: { slidesPerView: 3 },
        },
      });
    }
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(initSwiper);
})();

