// Landing page common script
(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  onReady(() => {
    // 1) Smooth scroll for internal anchors (with sticky-nav offset)
    try {
      const navH = () => {
        const v = getComputedStyle(document.documentElement).getPropertyValue("--nav-height");
        const n = Number(String(v).replace(/[^0-9.]/g, ""));
        return Number.isFinite(n) ? n : 74;
      };

      const scrollToHash = (hash) => {
        if (!hash || hash === "#") return;
        const target = document.querySelector(hash);
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const absoluteY = window.scrollY + rect.top;
        const offset = navH() + 12;
        window.scrollTo({
          top: Math.max(0, absoluteY - offset),
          behavior: "smooth",
        });
      };

      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener("click", (e) => {
          const href = a.getAttribute("href");
          if (!href || href === "#") return;
          const target = document.querySelector(href);
          if (!target) return;
          e.preventDefault();
          scrollToHash(href);
        });
      });
    } catch (err) {
      console.error("[smooth-scroll]", err);
    }

    // 2) Mobile nav toggle - close on click outside, on link click, and on escape
    try {
      const html = document.documentElement;
      const navToggle = document.querySelector(".nav-toggle");
      const nav = document.querySelector(".nav");
      let lastScroll = 0;

      function closeNav() {
        html.classList.remove("nav-open");
        if (navToggle) navToggle.setAttribute("aria-expanded", "false");
      }

      if (navToggle) {
        navToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const open = html.classList.toggle("nav-open");
          navToggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
      }

      // Close nav on link click (mobile)
      document.querySelectorAll(".nav-links a").forEach((link) => {
        link.addEventListener("click", () => {
          if (html.classList.contains("nav-open")) closeNav();
        });
      });

      // Close nav on outside click
      document.addEventListener("click", (e) => {
        if (html.classList.contains("nav-open") && nav && !nav.contains(e.target)) {
          closeNav();
        }
      });

      // Close nav on Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && html.classList.contains("nav-open")) closeNav();
      });

      // Navbar shrink on scroll
      window.addEventListener("scroll", () => {
        const sc = window.scrollY || 0;
        if (nav) {
          if (sc > 60 && sc > lastScroll) nav.classList.add("shrink");
          else if (sc < 60) nav.classList.remove("shrink");
        }
        lastScroll = sc;
      }, { passive: true });
    } catch (err) {
      console.error("[nav]", err);
    }

    // 3) Notification popup toggle + direct ke events
    try {
      const notifBtn = document.getElementById("nav-notif-btn");
      const notifPopup = document.getElementById("nav-notif-popup");
      if (notifBtn && notifPopup) {
        // Add badge if there's content
        const hasContent = notifPopup.querySelector(".nav-notif-item-wrap");
        if (hasContent) notifBtn.classList.add("has-new");

        notifBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = notifPopup.classList.toggle("open");
          if (isOpen) {
            const wrap = notifPopup.querySelector(".nav-notif-item-wrap");
            if (wrap) {
              const handler = function() {
                notifPopup.classList.remove("open");
                const target = document.querySelector("#events");
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
                this.removeEventListener("click", handler);
              };
              wrap.addEventListener("click", handler);
            }
          }
        });
        document.addEventListener("click", (e) => {
          if (!notifBtn.contains(e.target) && !notifPopup.contains(e.target)) {
            notifPopup.classList.remove("open");
          }
        });
      }
    } catch (err) {
      console.error("[notif]", err);
    }

    // 4) Logo click animation (re-numbered, was 3)
    try {
      const logo = document.querySelector(".logo-img");
      if (logo) {
        logo.addEventListener("click", () => {
          logo.classList.remove("logo-animate");
          void logo.offsetWidth;
          logo.classList.add("logo-animate");
        });
      }
    } catch (err) {
      console.error("[logo-animate]", err);
    }

    // 5) Theme toggle
    try {
      const root = document.documentElement;
      const toggle = document.querySelector(".theme-toggle");
      let currentTheme = "dark";

      function getPreferred() {
        const saved = localStorage.getItem("site-theme");
        if (saved === "light" || saved === "dark") return saved;
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }

      function applyTheme(name) {
        currentTheme = name;
        if (name === "light") root.classList.add("theme-light");
        else root.classList.remove("theme-light");
        const btn = document.querySelector(".theme-toggle");
        if (btn) btn.textContent = name === "light" ? "☀️" : "🌙";
      }

      applyTheme(getPreferred());

      if (toggle) {
        toggle.addEventListener("click", () => {
          const nextTheme = currentTheme === "light" ? "dark" : "light";
          localStorage.setItem("site-theme", nextTheme);
          applyTheme(nextTheme);
        });
      }
    } catch (err) {
      console.error("[theme]", err);
    }

    // 6) Navbar real-time date/time
    try {
      const dayEl = document.getElementById("nav-date-day");
      const valueEl = document.getElementById("nav-date-value");
      const timeEl = document.getElementById("nav-date-time");
      if (dayEl && valueEl && timeEl) {
        const fmtPad2 = (n) => String(n).padStart(2, "0");
        function updateNavDate() {
          const d = new Date();
          const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
          dayEl.textContent = days[d.getDay()] || "";
          valueEl.textContent = `${fmtPad2(d.getDate())}/${fmtPad2(d.getMonth() + 1)}/${d.getFullYear()}`;
          timeEl.textContent = `${fmtPad2(d.getHours())}:${fmtPad2(d.getMinutes())}:${fmtPad2(d.getSeconds())}`;
        }
        updateNavDate();
        setInterval(updateNavDate, 1000);
      }
    } catch (err) {
      console.error("[nav-date]", err);
    }

    // 7) Event modal (Landing page)
    try {
      const modal = document.getElementById("event-modal");
      const modalClose = modal ? modal.querySelector(".modal-close") : null;

      if (modal) {
        const modalTitle = document.getElementById("modal-title");
        const modalPoster = document.getElementById("modal-poster");
        const modalTime = document.getElementById("modal-time");
        const modalLocation = document.getElementById("modal-location");
        const modalDesc = document.getElementById("modal-desc");
        const modalActions = document.getElementById("modal-actions");

        function openModal() { modal.setAttribute("aria-hidden", "false"); }
        function closeModal() { modal.setAttribute("aria-hidden", "true"); }

        document.querySelectorAll(".view-details").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            if (!id) return;
            try {
              const res = await fetch(`/api/events/${id}`);
              if (!res.ok) throw new Error("not found");
              const data = await res.json();
              if (modalTitle) modalTitle.textContent = data.title || "";

              // Poster: show or hide column
              const modalBody = document.getElementById("modal-body");
              if (modalPoster) {
                if (data.poster) {
                  modalPoster.src = data.poster;
                  modalPoster.style.display = "";
                  if (modalBody) modalBody.classList.remove("no-poster");
                } else {
                  modalPoster.src = "";
                  modalPoster.style.display = "none";
                  if (modalBody) modalBody.classList.add("no-poster");
                }
              }

              if (modalTime) {
                const datePart = data.day ? (() => {
                  const s = String(data.day).trim();
                  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                  if (m) {
                    const d = new Date(+m[1], +m[2]-1, +m[3]);
                    if (!isNaN(d)) return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                  }
                  return s;
                })() : "";
                const timePart = data.time ? ` | ${data.time}` : "";
                modalTime.textContent = datePart + timePart;
              }
              if (modalLocation) modalLocation.textContent = data.location || "";
              if (modalDesc) modalDesc.textContent = data.description || "";
              if (modalActions) {
                modalActions.innerHTML = "";
                if (data.googleForm) {
                  const a = document.createElement("a");
                  a.href = data.googleForm;
                  a.target = "_blank";
                  a.rel = "noopener noreferrer";
                  a.className = "btn primary";
                  a.textContent = "Daftar ke Google Form";
                  modalActions.appendChild(a);
                }
              }
              openModal();
            } catch (err) {
              console.error("[modal]", err);
            }
          });
        });

        if (modalClose) modalClose.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
      }
    } catch (err) {
      console.error("[event-modal]", err);
    }

    // 8) Reveal on scroll (Intersection Observer)
    try {
      const items = document.querySelectorAll(".reveal");
      if (items.length) {
        const obs = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add("active");
                obs.unobserve(e.target);
              }
            });
          },
          { threshold: 0.1 }
        );
        items.forEach((i) => obs.observe(i));
      }
    } catch (err) {
      console.error("[reveal]", err);
    }

    // 9) Events Showcase (Dots Carousel - Poster Left + Detail Right)
    try {
      const showcaseInner = document.getElementById("events-showcase-inner");
      const dotsContainer = document.getElementById("events-dots");
      if (!showcaseInner || !dotsContainer) return;

      const slides = Array.from(showcaseInner.querySelectorAll(".events-slide"));
      if (!slides.length) return;

      let current = 0;
      let isAnimating = false;

      // Create dots
      slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className = "events-dot" + (i === 0 ? " active" : "");
        dot.setAttribute("aria-label", `Ke event ${i + 1}`);
        dot.type = "button";
        dot.addEventListener("click", () => goTo(i));
        dotsContainer.appendChild(dot);
      });

      const dots = Array.from(dotsContainer.querySelectorAll(".events-dot"));

      function goTo(index) {
        if (isAnimating || index === current || index < 0 || index >= slides.length) return;
        isAnimating = true;

        // Update slides
        slides.forEach((s, i) => {
          s.classList.toggle("active", i === index);
          // Reset animation for new slide
          if (i === index) {
            s.style.animation = "none";
            void s.offsetWidth;
            const dir = index > current ? "right" : "left";
            s.style.animation = `events-fade-in 400ms ease both`;
          }
        });

        // Update dots
        dots.forEach((d, i) => d.classList.toggle("active", i === index));

        current = index;

        setTimeout(() => { isAnimating = false; }, 420);
      }

      // Show first slide
      slides.forEach((s, i) => s.classList.toggle("active", i === 0));

      // ── Auto-play: slide every 10 seconds ──
      let autoPlayTimer = null;

      function startAutoPlay() {
        stopAutoPlay();
        autoPlayTimer = setTimeout(function tick() {
          var next = (current + 1) % slides.length;
          if (!isAnimating) goTo(next);
          autoPlayTimer = setTimeout(tick, 10000);
        }, 10000);
      }

      function stopAutoPlay() {
        if (autoPlayTimer) {
          clearTimeout(autoPlayTimer);
          autoPlayTimer = null;
        }
      }

      // Start auto-play when page loads
      startAutoPlay();

      // Restart on dot click
      dots.forEach(function(d) {
        d.addEventListener("click", startAutoPlay);
      });

      // Pause on hover, resume on leave
      var showcase = document.getElementById("events-showcase");
      if (showcase) {
        showcase.addEventListener("mouseenter", stopAutoPlay);
        showcase.addEventListener("mouseleave", startAutoPlay);
      }
    } catch (err) {
      console.error("[events-showcase]", err);
    }

    // 10) Old carousel (cleanup - only if still used elsewhere)
    try {
      const oldCarousels = document.querySelectorAll(".carousel-wrapper:not(#events-carousel)");
      if (oldCarousels.length) {
        function initScrollCarousel(wrapperEl) {
          if (!wrapperEl) return;
          const prevBtn = wrapperEl.querySelector(".carousel-btn.prev");
          const nextBtn = wrapperEl.querySelector(".carousel-btn.next");
          const firstCard = wrapperEl.querySelector(".carousel-item");

          const scrollByCard = (dir) => {
            if (!firstCard) return;
            const cardWidth = firstCard.getBoundingClientRect().width;
            const gap = 18;
            wrapperEl.scrollBy({ left: (cardWidth + gap) * dir, behavior: "smooth" });
          };

          if (prevBtn) prevBtn.addEventListener("click", () => scrollByCard(-1));
          if (nextBtn) nextBtn.addEventListener("click", () => scrollByCard(1));
        }

        oldCarousels.forEach(initScrollCarousel);
      }
    } catch (err) {
      console.error("[old-carousel]", err);
    }

    // 11) Documentation Grid Slider (3 items/page desktop, 2 items/page mobile)
    try {
      const slider = document.getElementById("docs-slider");
      const track = document.getElementById("docs-grid-track");
      const pagesEl = document.getElementById("docs-slider-pages");
      if (!slider || !track || !pagesEl) return;

      const items = Array.from(track.querySelectorAll(".docs-grid-item"));
      if (!items.length) return;

      let currentPage = 0;

      function getItemsPerPage() {
        return window.innerWidth <= 900 ? 2 : 3;
      }

      function getTotalPages() {
        const perPage = getItemsPerPage();
        return Math.max(1, Math.ceil(items.length / perPage));
      }

      function showPage(page) {
        const perPage = getItemsPerPage();
        const total = getTotalPages();
        currentPage = Math.max(0, Math.min(page, total - 1));

        items.forEach((item, i) => {
          const start = currentPage * perPage;
          const end = start + perPage;
          item.style.display = (i >= start && i < end) ? "" : "none";
        });

        pagesEl.textContent = `${currentPage + 1} / ${total}`;
      }

      const prevBtn = slider.querySelector(".docs-slider-btn.prev");
      const nextBtn = slider.querySelector(".docs-slider-btn.next");

      if (prevBtn) prevBtn.addEventListener("click", () => showPage(currentPage - 1));
      if (nextBtn) nextBtn.addEventListener("click", () => showPage(currentPage + 1));

      showPage(0);

      let resizeTimer;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => showPage(currentPage), 200);
      });
    } catch (err) {
      console.error("[docs-slider]", err);
    }

    // 12) Auth card entrance animations
    try {
      const cards = document.querySelectorAll(".auth-card");
      if (cards.length) {
        cards.forEach((c, i) => setTimeout(() => c.classList.add("enter"), 80 + i * 60));
      }
    } catch (err) {
      console.error("[auth-entrances]", err);
    }
  });
})();