// Bridge: menyediakan window.initSwiperForPage untuk load-swiper.js
// File ini sengaja jadi entrypoint tunggal (tanpa duplikasi logic).

(function () {
  'use strict';

  window.initSwiperForPage = function initSwiperForPage() {
    if (!window.Swiper) return;

    // Upcoming Events
    const eventsEl = document.querySelector('#events .events-swiper');
    if (eventsEl) {
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
  };
})();


