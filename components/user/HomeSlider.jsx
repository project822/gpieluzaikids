'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icons';

// Adegan ilustrasi ringan (SVG inline, tanpa file eksternal).
// Untuk memakai foto asli cukup beri slide properti `src` (lihat lib/data.js).
function SlideScene({ scene }) {
  if (scene === 'worship') {
    return (
      <svg viewBox="0 0 800 560" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden>
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          <radialGradient id="wc" cx="50%" cy="38%" r="42%">
            <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect width="800" height="560" fill="url(#wg)" />
        <circle cx="400" cy="210" r="190" fill="url(#wc)" />
        {/* Sinar panggung */}
        <polygon points="180,0 300,560 90,560" fill="url(#wp)" />
        <polygon points="620,0 710,560 500,560" fill="url(#wp)" />
        {/* Salib kemuliaan */}
        <g fill="#fbbf24" opacity="0.95">
          <rect x="390" y="110" width="20" height="96" rx="4" />
          <rect x="364" y="134" width="72" height="20" rx="4" />
        </g>
        {/* Siluet jemaat */}
        <Silhouette x={230} y={398} raise />
        <Silhouette x={318} y={386} raise />
        <Silhouette x={400} y={392} />
        <Silhouette x={482} y={386} raise />
        <Silhouette x={570} y={398} raise />
        {/* Partikel */}
        {[
          [140, 210], [250, 140], [330, 260], [470, 150], [560, 230], [660, 170], [610, 300],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={3} fill="#fde68a" opacity={0.8} />
        ))}
      </svg>
    );
  }

  if (scene === 'fellowship') {
    return (
      <svg viewBox="0 0 800 560" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden>
        <defs>
          <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="55%" stopColor="#fdba74" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
          <linearGradient id="fh" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b1d3f" />
            <stop offset="100%" stopColor="#140f26" />
          </linearGradient>
        </defs>
        <rect width="800" height="560" fill="url(#fg)" />
        <circle cx="400" cy="330" r="120" fill="#fbbf24" opacity="0.9" />
        {/* Bukit gelap */}
        <path d="M0 400 Q 200 350 420 400 T 800 390 L800 560 L0 560 Z" fill="url(#fh)" />
        {/* Keluarga bergandengan tangan */}
        <g fill="#0d0a1f">
          <ellipse cx="300" cy="432" rx="26" ry="44" />
          <circle cx="300" cy="386" r="18" />
          <ellipse cx="370" cy="428" rx="24" ry="42" />
          <circle cx="370" cy="383" r="17" />
          <ellipse cx="440" cy="432" rx="26" ry="44" />
          <circle cx="440" cy="386" r="18" />
          <ellipse cx="510" cy="428" rx="24" ry="42" />
          <circle cx="510" cy="383" r="17" />
          {/* lengan */}
          <path d="M280 424 q35 -26 68 0" stroke="#0d0a1f" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M396 424 q35 -26 68 0" stroke="#0d0a1f" strokeWidth="9" fill="none" strokeLinecap="round" />
        </g>
        {/* Burung */}
        <g stroke="#7f1d1d" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7">
          <path d="M120 130 q10 -10 20 0 q10 -10 20 0" />
          <path d="M640 100 q10 -10 20 0 q10 -10 20 0" />
          <path d="M690 150 q8 -8 16 0 q8 -8 16 0" />
        </g>
      </svg>
    );
  }

  // scene 'church' (default)
  return (
    <svg viewBox="0 0 800 560" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden>
      <defs>
        <linearGradient id="cs" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
        <radialGradient id="csu" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
      <rect width="800" height="560" fill="url(#cs)" />
      <circle cx="660" cy="90" r="46" fill="url(#csu)" />
      <circle cx="660" cy="90" r="62" fill="#fde68a" opacity="0.35" />
      <g fill="#fff" opacity="0.95">
        <ellipse cx="150" cy="90" rx="52" ry="22" />
        <ellipse cx="196" cy="76" rx="34" ry="18" />
        <ellipse cx="110" cy="78" rx="30" ry="16" />
      </g>
      <path d="M0 380 Q 200 320 420 370 T 800 360 L800 560 L0 560 Z" fill="#86efac" opacity="0.9" />
      <path d="M0 430 Q 240 370 500 420 T 800 410 L800 560 L0 560 Z" fill="url(#cg)" />
      {/* Gedung gereja */}
      <g>
        <rect x="330" y="230" width="140" height="190" rx="8" fill="#fdf6e3" stroke="#e5d9b8" strokeWidth="2" />
        <polygon points="400,150 290,235 510,235" fill="#92400e" />
        <rect x="390" y="135" width="20" height="26" rx="3" fill="#92400e" />
        <path d="M400 78 v60 M366 108 h68" stroke="#b45309" strokeWidth="9" strokeLinecap="round" />
        <rect x="378" y="320" width="44" height="56" rx="22" fill="#7dd3fc" stroke="#0ea5e9" strokeWidth="4" />
        <rect x="378" y="306" width="44" height="10" fill="#0ea5e9" />
        <circle cx="400" cy="350" r="4" fill="#fff" />
        <rect x="308" y="280" width="30" height="22" rx="5" fill="#fcd34d" />
        <rect x="462" y="280" width="30" height="22" rx="5" fill="#fcd34d" />
      </g>
      {/* Pohon */}
      <g>
        <rect x="150" y="400" width="16" height="60" rx="4" fill="#92400e" />
        <circle cx="158" cy="380" r="42" fill="#16a34a" />
        <circle cx="128" cy="400" r="30" fill="#15803d" />
        <circle cx="190" cy="402" r="30" fill="#15803d" />
        <rect x="634" y="400" width="14" height="60" rx="4" fill="#92400e" />
        <circle cx="641" cy="382" r="38" fill="#16a34a" />
        <circle cx="614" cy="402" r="28" fill="#15803d" />
        <circle cx="668" cy="404" r="28" fill="#15803d" />
      </g>
      {/* Jalan */}
      <path d="M400 470 l60 90 h-120 z" fill="#e7e5e4" />
    </svg>
  );
}

function Silhouette({ x, y, raise = false }) {
  return (
    <g fill="#0f0a1f">
      <circle cx={x} cy={y - 40} r="16" />
      <rect x={x - 14} y={y - 22} width="28" height="58" rx="13" />
      {raise ? (
        <>
          <path d={`M${x - 12} ${y - 10} q -26 -18 -30 -46`} stroke="#0f0a1f" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d={`M${x + 12} ${y - 10} q 26 -18 30 -46`} stroke="#0f0a1f" strokeWidth="9" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={`M${x - 12} ${y - 8} q -22 4 -28 -10`} stroke="#0f0a1f" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d={`M${x + 12} ${y - 8} q 22 4 28 -10`} stroke="#0f0a1f" strokeWidth="9" fill="none" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

export default function HomeSlider({ slides }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const total = slides.length;

  const go = useCallback(
    (dir) => setIndex((i) => (i + dir + total) % total),
    [total]
  );

  useEffect(() => {
    if (paused || total <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), 5500);
    return () => clearInterval(t);
  }, [paused, total]);

  if (total === 0) return null;

  return (
    <div
      className="home-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label="Foto gereja"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="slider-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <div
            className="slider-slide"
            key={s.id}
            aria-hidden={i !== index}
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} dari ${total}`}
          >
            {s.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.src} alt={s.title} width={800} height={450} loading={index === 0 ? 'eager' : 'lazy'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <SlideScene scene={s.scene} />
            )}
            <div className="slider-caption">
              <span className="slider-title">{s.title}</span>
              <span className="slider-sub">{s.caption}</span>
            </div>
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button className="slider-arrow prev" onClick={() => go(-1)} aria-label="Slide sebelumnya">
            <Icon name="chevron-left" size={20} />
          </button>
          <button className="slider-arrow next" onClick={() => go(1)} aria-label="Slide berikutnya">
            <Icon name="chevron-right" size={20} />
          </button>
          <div className="slider-dots">
            {slides.map((s, i) => (
              <button
                key={s.id}
                className={`slider-dot ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Ke slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
