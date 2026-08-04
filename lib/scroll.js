/**
 * ── Scroll Animation Module ──
 * Lightweight, native scroll animations using IntersectionObserver.
 * No libraries required. Progressive enhancement: content accessible without JS.
 *
 * Features:
 * 1. Native smooth scrolling via CSS scroll-behavior: smooth
 * 2. Intersection Observer for scroll-triggered fade (two-way: section
 *    fade-in saat masuk viewport, fade-out halus saat keluar viewport)
 * 3. Staggered reveal for lists/grids
 * 4. Active section highlighting in navigation
 * 5. prefers-reduced-motion respected
 * 6. No-JS fallback: all content visible without JavaScript
 * 7. Public API `window.ScrollAnim.refresh()` — aman dipanggil berkali-kali
 *    untuk mengamati elemen [data-reveal]/[data-stagger] yang dirender
 *    secara dinamis setelah halaman dimuat (mis. hasil fetch).
 */

(function () {
  'use strict';

  // ── Configuration ──
  var CONFIG = {
    revealThreshold: 0.08,
    revealRootMargin: '0px 0px -60px 0px',
    navThreshold: 0.25,
    navRootMargin: '0px 0px -20% 0px',
    staggerBaseDelay: 80,
    parallaxStrength: 0.15
  };

  // ── State modul (supaya init bisa dijalankan ulang tanpa duplikasi) ──
  var revealObserver = null;
  var observedReveal = new Set();
  var observedStagger = new Set();
  var staggerObservers = new WeakMap();

  // ── Utility: DOM ready ──
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // ── Check for reduced motion preference ──
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── Check IntersectionObserver support ──
  function supportsIntersectionObserver() {
    return 'IntersectionObserver' in window;
  }

  // ── Force visible (fallback: reduced motion / tanpa IO / tanpa JS) ──
  function forceVisible(el) {
    el.classList.add('active');
    el.style.opacity = '1';
    el.style.transform = 'none';
  }

  // ── 1. Scroll-Triggered Fade via IntersectionObserver ──
  // Dua arah: elemen fade-in saat masuk viewport, dan fade-out dengan halus
  // saat keluar viewport (observer TIDAK di-unobserve supaya bisa hilang lagi).
  // Ringan: IntersectionObserver cuma memanggil callback saat status berubah,
  // tidak ada work di tiap frame scroll.
  function initRevealAnimations() {
    var revealEls = document.querySelectorAll('[data-reveal]');
    if (!revealEls.length) return;

    // If reduced motion or no IO support, just make everything visible
    if (prefersReducedMotion() || !supportsIntersectionObserver()) {
      revealEls.forEach(forceVisible);
      return;
    }

    // Observer dibuat sekali saja, lalu dipakai ulang oleh refresh()
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var el = entry.target;
            // Apply custom delay/duration if set (tetap dipertahankan)
            var delay = el.getAttribute('data-reveal-delay');
            if (delay) {
              el.style.transitionDelay = delay + 'ms';
            }
            var duration = el.getAttribute('data-reveal-duration');
            if (duration) {
              el.style.transitionDuration = duration + 'ms';
            }
            // Fade in saat masuk viewport, fade out saat keluar viewport
            el.classList.toggle('active', entry.isIntersecting);
          });
        },
        {
          threshold: CONFIG.revealThreshold,
          rootMargin: CONFIG.revealRootMargin
        }
      );
    }

    revealEls.forEach(function (el) {
      // Item di dalam group [data-stagger] diamati oleh observer stagger,
      // jangan diamati dua kali di sini.
      if (el.closest('[data-stagger]')) return;
      if (!observedReveal.has(el)) {
        observedReveal.add(el);
        revealObserver.observe(el);
      }
    });
  }

  // ── 2. Staggered Reveal for Lists (children animate one by one) ──
  function getStaggerObserver(group) {
    // Satu observer per group, dibuat sekali dan di-cache (WeakMap)
    var cached = staggerObservers.get(group);
    if (cached) return cached;

    var baseDelay = parseInt(group.getAttribute('data-stagger-delay'), 10) || CONFIG.staggerBaseDelay;

    var observer = new IntersectionObserver(
      function (entries) {
        // Ambil ulang daftar item tiap callback agar item baru ikut terhitung
        var items = group.querySelectorAll('[data-reveal]');
        entries.forEach(function (entry) {
          var el = entry.target;
          var index = Array.prototype.indexOf.call(items, el);
          if (entry.isIntersecting) {
            // Masuk: delay berurutan dari atas
            el.style.transitionDelay = (index * baseDelay) + 'ms';
            el.classList.add('active');
          } else {
            // Saat keluar: delay dibalik supaya fade-out natural berurutan
            el.style.transitionDelay = ((items.length - 1 - index) * baseDelay) + 'ms';
            el.classList.remove('active');
          }
        });
      },
      {
        threshold: CONFIG.revealThreshold,
        rootMargin: CONFIG.revealRootMargin
      }
    );

    staggerObservers.set(group, observer);
    return observer;
  }

  function initStaggerReveal() {
    var staggerGroups = document.querySelectorAll('[data-stagger]');
    if (!staggerGroups.length) return;

    if (prefersReducedMotion() || !supportsIntersectionObserver()) {
      staggerGroups.forEach(function (group) {
        group.querySelectorAll('[data-reveal]').forEach(forceVisible);
      });
      return;
    }

    staggerGroups.forEach(function (group) {
      var observer = getStaggerObserver(group);
      var items = group.querySelectorAll('[data-reveal]');
      items.forEach(function (item) {
        if (!observedStagger.has(item)) {
          observedStagger.add(item);
          observer.observe(item);
        }
      });
    });
  }

  // ── 3. Active Nav Section Highlighting ──
  function initNavHighlight() {
    if (!supportsIntersectionObserver()) return;

    var sections = document.querySelectorAll('[data-nav-section]');
    var navLinks = document.querySelectorAll('[data-nav-link]');
    if (!sections.length || !navLinks.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.getAttribute('id');
            if (!id) return;
            navLinks.forEach(function (link) {
              var href = link.getAttribute('href');
              if (href === '#' + id) {
                link.classList.add('active');
              } else {
                link.classList.remove('active');
              }
            });
          }
        });
      },
      {
        threshold: CONFIG.navThreshold,
        rootMargin: CONFIG.navRootMargin
      }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  // ── 4. Subtle Parallax on Scroll (only on elements with data-parallax) ──
  function initParallax() {
    if (prefersReducedMotion()) return;

    var parallaxEls = document.querySelectorAll('[data-parallax]');
    if (!parallaxEls.length) return;

    var ticking = false;
    var handleScroll = function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          var scrollY = window.scrollY;
          parallaxEls.forEach(function (el) {
            var speed = parseFloat(el.getAttribute('data-parallax-speed')) || CONFIG.parallaxStrength;
            var rect = el.getBoundingClientRect();
            // Only apply when element is near viewport
            if (rect.top < window.innerHeight + 200 && rect.bottom > -200) {
              var offset = scrollY * speed;
              el.style.transform = 'translateY(' + offset + 'px)';
            }
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }  // Smooth scroll untuk anchor ditangani main.js (memakai var(--nav-height)),
  // jadi tidak diduplikasi di sini untuk menghindari double scrollTo.



  // ── 7. Lazy Loading Images (native + IntersectionObserver fallback) ──
  function initLazyImages() {
    var lazyImgs = document.querySelectorAll('img[data-src]');
    if (!lazyImgs.length) return;

    if ('loading' in HTMLImageElement.prototype) {
      // Native lazy loading supported
      lazyImgs.forEach(function (img) {
        img.src = img.getAttribute('data-src');
        img.loading = 'lazy';
        if (img.hasAttribute('data-srcset')) {
          img.srcset = img.getAttribute('data-srcset');
        }
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
      });
      return;
    }

    // Fallback: IntersectionObserver
    if (supportsIntersectionObserver()) {
      var imgObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var img = entry.target;
              img.src = img.getAttribute('data-src');
              if (img.hasAttribute('data-srcset')) {
                img.srcset = img.getAttribute('data-srcset');
              }
              img.removeAttribute('data-src');
              img.removeAttribute('data-srcset');
              imgObserver.unobserve(img);
            }
          });
        },
        { rootMargin: '200px 0px' }
      );

      lazyImgs.forEach(function (img) {
        imgObserver.observe(img);
      });
    } else {
      // No support: load all immediately
      lazyImgs.forEach(function (img) {
        img.src = img.getAttribute('data-src');
        if (img.hasAttribute('data-srcset')) {
          img.srcset = img.getAttribute('data-srcset');
        }
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
      });
    }
  }

  // ── 8. Counter Animation (for stat numbers) ──
  function initCounters() {
    var counters = document.querySelectorAll('[data-counter]');
    if (!counters.length || prefersReducedMotion()) return;

    if (!supportsIntersectionObserver()) {
      // Fallback: just show the final value
      counters.forEach(function (el) {
        var target = parseInt(el.getAttribute('data-counter-target'), 10) || 0;
        el.textContent = target;
      });
      return;
    }

    counters.forEach(function (counter) {
      var target = parseInt(counter.getAttribute('data-counter-target'), 10) || 0;
      var duration = parseInt(counter.getAttribute('data-counter-duration'), 10) || 1500;
      var suffix = counter.getAttribute('data-counter-suffix') || '';
      var prefix = counter.getAttribute('data-counter-prefix') || '';
      var animated = false;

      var obs = new IntersectionObserver(
        function (entries) {
          if (entries[0].isIntersecting && !animated) {
            animated = true;
            obs.unobserve(counter);
            animateCounter(counter, target, duration, prefix, suffix);
          }
        },
        { threshold: 0.5 }
      );

      obs.observe(counter);
    });
  }

  function animateCounter(el, target, duration, prefix, suffix) {
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * target);
      el.textContent = prefix + current + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = prefix + target + suffix;
      }
    }

    window.requestAnimationFrame(step);
  }

  // ── 9. Enhanced CSS Class: .no-js fallback ──
  function initNoJsFallback() {
    // Remove no-js class if JS is enabled
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
  }

  // ── 10. Scroll-to-Top button ──
  function initScrollToTop() {
    var btn = document.querySelector('[data-scroll-top]');
    if (!btn) return;

    var handleScroll = function () {
      if (window.scrollY > 400) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Public API ──
  // refresh(): re-scan dokumen untuk elemen [data-reveal]/[data-stagger]
  // yang baru (mis. kartu hasil fetch). Idempotent: aman dipanggil berkali-kali.
  function refresh() {
    initRevealAnimations();
    initStaggerReveal();
  }

  // ── Initialize Everything ──
  onReady(function () {
    initNoJsFallback();
    initRevealAnimations();
    initStaggerReveal();
    initNavHighlight();
    initParallax();
    initLazyImages();
    initCounters();
    initScrollToTop();
  });

  window.ScrollAnim = { refresh: refresh };

})();
