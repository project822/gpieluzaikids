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

    // 3) Logo click animation
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

    // 4) Theme toggle
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

    // 5) Navbar real-time date/time
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

    // 6) Event modal (Landing page)
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
              if (modalPoster) modalPoster.src = data.poster || "";
              if (modalTime) modalTime.textContent = `${data.day || ""} | ${data.time || ""}`;
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

    // 7) Reveal on scroll (Intersection Observer)
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

    // 8) Image carousel (Upcoming/Dokumentasi) - simplified
    try {
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

      document.querySelectorAll(".carousel-wrapper").forEach((wrapperEl) => {
        if (wrapperEl.getAttribute("data-carousel-mode") === "single") {
          const items = Array.from(wrapperEl.querySelectorAll(".carousel-item"));
          if (!items.length) return;

          let index = 0;
          const track = wrapperEl.querySelector(".carousel-track");
          const itemGap = 18;

          const layoutSingle = () => {
            const item = items[index];
            if (!item) return;
            const wrapW = wrapperEl.getBoundingClientRect().width;
            const itemW = item.getBoundingClientRect().width;
            const centerOffset = wrapW / 2 - itemW / 2;
            const itemLeft = item.offsetLeft;
            if (track) track.style.transform = `translateX(${centerOffset - itemLeft}px)`;
          };

          const btnPrev = wrapperEl.querySelector(".carousel-btn.prev");
          const btnNext = wrapperEl.querySelector(".carousel-btn.next");

          if (btnPrev) btnPrev.addEventListener("click", () => { index = (index - 1 + items.length) % items.length; layoutSingle(); });
          if (btnNext) btnNext.addEventListener("click", () => { index = (index + 1) % items.length; layoutSingle(); });

          layoutSingle();
          window.addEventListener("resize", layoutSingle);
          return;
        }

        initScrollCarousel(wrapperEl);
      });
    } catch (err) {
      console.error("[carousel]", err);
    }

    // 9) Auth card entrance animations
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