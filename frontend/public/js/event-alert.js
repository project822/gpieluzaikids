/*
  Event reminder: when an event is T-7 days from now, show an alert banner.
  Click banner => redirect to event anchor (#events) and open the event modal.
*/

(function () {
  "use strict";

  function parseEventDate(dayStr) {
    if (!dayStr) return null;

    // Event day currently can be either:
    // - "YYYY-MM-DD" (admin form input[type="date"] default)
    // - "DD/MM/YYYY" (navbar display)
    // We parse both so alert works regardless.
    const s = String(dayStr).trim();

    let dt = null;

    // Case 1: YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      dt = new Date(y, mo, d);
    } else {
      // Case 2: DD/MM/YYYY
      m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        const d = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const y = Number(m[3]);
        dt = new Date(y, mo, d);
      }
    }

    if (!dt || Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function daysBetween(a, b) {
    // Compare by date (ignore time)
    const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    const diffMs = a0.getTime() - b0.getTime();
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  }

  function init() {
    const eventsEl = document.getElementById("events");
    const cards = Array.from(
      document.querySelectorAll(".carousel-item.slide[data-id]"),
    );

    if (!cards.length || !eventsEl) return;

    const now = new Date();

    // Find events that are 7 days away (inclusive within the whole day)
    const hits = cards
      .map((card) => {
        const id = card.getAttribute("data-id");

        const timeTextEl = card.querySelector(".time");
        const timeText = timeTextEl ? timeTextEl.textContent.trim() : "";

        // your template: <p class="time"><%= event.day %> | <%= event.time %></p>
        const dayStr = timeText ? timeText.split("|")[0].trim() : "";

        const eventDate = parseEventDate(dayStr);
        if (!eventDate) return null;

        const diff = daysBetween(eventDate, now);
        return { id, diff, eventDate };
      })
      .filter(Boolean);

    const sevenDaysAway = hits.find((h) => h.diff === 7);
    if (!sevenDaysAway) return;

    const eventDayRaw =
      String(sevenDaysAway.eventDate.getFullYear()).padStart(4, "0") +
      "-" +
      String(sevenDaysAway.eventDate.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(sevenDaysAway.eventDate.getDate()).padStart(2, "0");

    const bannerKey = `eventReminderShown:${sevenDaysAway.id}:${eventDayRaw}:H-7`;
    const alreadyShownForThisDay = localStorage.getItem(bannerKey) === "1";

    // Tampilkan banner saat H-7 (dan biar permanen setelah refresh)
    if (!alreadyShownForThisDay) {
      localStorage.setItem(bannerKey, "1");
    }

    // Jika sudah ada banner sebelumnya, jangan dobel
    if (document.getElementById("event-reminder-banner")) return;

    const banner = document.createElement("div");
    banner.id = "event-reminder-banner";
    // Sidebar kecil di samping area date realtime (navbar)
    banner.style.position = "fixed";
    banner.style.right = "12px";
    banner.style.top = "74px";
    banner.style.left = "auto";
    banner.style.bottom = "auto";
    banner.style.width = "360px";

    banner.style.zIndex = "9999";
    banner.style.padding = "12px 14px";
    banner.style.borderRadius = "14px";
    banner.style.background = "rgba(0,0,0,0.72)";
    banner.style.backdropFilter = "blur(8px)";
    banner.style.color = "#fff";
    banner.style.border = "1px solid rgba(255,255,255,0.15)";
    banner.style.boxShadow = "0 12px 40px rgba(0,0,0,0.35)";

    // baca judul langsung dari kartu supaya pasti tampil
    const card = cards.find(
      (c) => c.getAttribute("data-id") === sevenDaysAway.id,
    );
    const t = card ? card.querySelector(".meta h3") : null;
    const title = t ? t.textContent.trim() : "";

    banner.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:10px;">
        <div style="font-size:12.5px; opacity:0.98; flex:1;">
          <b style="color:#34d399;">🔔</b> ${title}
          <div style="opacity:0.85; margin-top:2px;">7 hari lagi</div>
        </div>
        <button id="event-reminder-go" style="cursor:pointer; border:none; padding:7px 10px; border-radius:12px; font-weight:800; background:#2563eb; color:white; white-space:nowrap;">Lihat</button>
        <button id="event-reminder-close" aria-label="Tutup" style="cursor:pointer; border:none; padding:7px 10px; border-radius:12px; font-weight:900; background:rgba(255,255,255,0.08); color:white;">✕</button>
      </div>
    `;

    document.body.appendChild(banner);

    const closeBtn = document.getElementById("event-reminder-close");
    const goBtn = document.getElementById("event-reminder-go");

    function close() {
      banner.remove();
    }

    // Supaya refresh tidak bikin halaman "loncat" satu-per-satu, simpan posisi scroll.
    // Saat click tombol, pulihkan posisi scroll sebelum memicu modal.
    const savedScrollY = (() => {
      try {
        const v = sessionStorage.getItem("eventReminderScrollY");
        return v ? Number(v) : window.scrollY;
      } catch {
        return window.scrollY;
      }
    })();

    closeBtn &&
      closeBtn.addEventListener("click", () => {
        try {
          sessionStorage.setItem(
            "eventReminderScrollY",
            String(window.scrollY),
          );
        } catch {}
        close();
      });

    // Refresh tetap pada posisi terakhir sebelum muncul banner
    window.addEventListener("load", () => {
      try {
        const v = sessionStorage.getItem("eventReminderScrollY");
        const y = v ? Number(v) : null;
        if (typeof y === "number" && !Number.isNaN(y)) {
          window.scrollTo({ top: y, behavior: "instant" });
        } else if (typeof savedScrollY === "number") {
          window.scrollTo(0, savedScrollY);
        }
      } catch {}
    });

    goBtn &&
      goBtn.addEventListener("click", () => {
        // Jangan biarkan action modal/anchor mengubah scroll.
        try {
          if (typeof savedScrollY === "number" && !Number.isNaN(savedScrollY)) {
            window.scrollTo({ top: savedScrollY, behavior: "instant" });
          }
        } catch {
          window.scrollTo(0, savedScrollY);
        }

        close();

        // Auto scroll ke section event supaya modal terbuka dan user tidak perlu scroll manual.
        const targetCard = cards.find(
          (c) => c.getAttribute("data-id") === sevenDaysAway.id,
        );
        if (targetCard) {
          try {
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            targetCard.scrollIntoView(true);
          }

          // Tunggu sedikit agar scroll selesai, baru klik tombol detail.
          setTimeout(() => {
            const btn = targetCard.querySelector(".view-details");
            if (btn) btn.click();
          }, 250);
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
