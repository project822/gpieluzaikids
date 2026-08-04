// ============================================================
// GPI ELUZAI KIDS — Navbar + Hamburger Mobile
// Implementasi docs/PRD-Navbar-Hamburger-Mobile.md (vanilla JS)
// ============================================================
(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    var html = document.documentElement;
    var nav = document.querySelector(".nav");
    var menu = document.querySelector("[data-nav-menu]");
    var toggle = document.querySelector("[data-nav-toggle]");

    // JS aktif → hapus class no-js (fallback CSS noscript tidak lagi dipakai)
    html.classList.remove("no-js");

    function isOpen() {
      return html.classList.contains("nav-open");
    }

    function setMenu(open) {
      html.classList.toggle("nav-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Tutup navigasi" : "Buka navigasi");
      }
    }

    /* 1) Toggle saat hamburger diklik */
    if (toggle) {
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        setMenu(!isOpen());
      });
    }

    /* 2) Tutup saat link menu diklik */
    var links = (menu ? menu : document).querySelectorAll("a");
    links.forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false);
      });
    });

    /* 3) Tutup saat klik di luar navbar */
    document.addEventListener("click", function (e) {
      if (isOpen() && nav && !nav.contains(e.target)) setMenu(false);
    });

    /* 4) Tutup saat Escape (+ kembalikan fokus ke tombol) */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) {
        setMenu(false);
        if (toggle) toggle.focus();
      }
    });

    /* 5) Tutup otomatis saat resize melewati breakpoint desktop.
       Harus sinkron dengan `max-width: 900px` di CSS — jangan ubah
       salah satunya saja. */
    var mq = window.matchMedia("(min-width: 901px)");
    var onDesktopChange = function (e) {
      if (e.matches) setMenu(false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onDesktopChange);
    else if (mq.addListener) mq.addListener(onDesktopChange); // Safari < 14

    /* 6) Shrink on scroll (throttled dengan rAF) */
    var lastScroll = 0;
    var raf = null;

    window.addEventListener(
      "scroll",
      function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var sc = window.scrollY || 0;
          if (nav) {
            if (sc > 60 && sc > lastScroll) nav.classList.add("shrink");
            else if (sc < 60) nav.classList.remove("shrink");
          }
          lastScroll = sc;
        });
      },
      { passive: true }
    );

    /* 7) Body scroll lock saat menu terbuka */
    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        document.body.style.overflow = isOpen() ? "hidden" : "";
      });
      observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    }

    /* 8) Smooth scroll ke anchor dengan offset navbar.
       Hormati prefers-reduced-motion (FR-12). */
    var reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        var navH = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--nav-height")
        );
        if (!isFinite(navH)) navH = 68;
        var top = target.getBoundingClientRect().top + window.scrollY - navH - 12;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  });
})();
