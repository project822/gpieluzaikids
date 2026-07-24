/* ════════════════════════════════════════════
   PLAYLIST — Music Player & Interactions
   ════════════════════════════════════════════ */

(function() {
  'use strict';

  // ── State ──
  let songs = [];
  let currentIndex = -1;
  let isPlaying = false;
  let audio = null;
  let playlistSongs = {}; // cache: { playlistId: [songs] }

  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);
  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => (ctx || document).querySelectorAll(sel);

  // Player elements
  const player = $('pl-player');
  const playerTitle = $('pl-player-title');
  const playerPlayBtn = $('pl-play-btn');
  const playerPlayIcon = $('pl-play-icon');
  const playerPrevBtn = $('pl-prev-btn');
  const playerNextBtn = $('pl-next-btn');
  const progressFill = $('pl-progress-fill');
  const progressBar = $('pl-progress-bar');
  const progressCurrent = $('pl-progress-current');
  const progressTotal = $('pl-progress-total');
  const volFill = $('pl-vol-fill');
  const volBar = $('pl-vol-bar');
  const volBtn = $('pl-vol-btn');
  const playerFavBtn = $('pl-player-fav');
  const playerDlBtn = $('pl-player-dl');

  // Toast
  const toast = $('pl-toast');

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // ── Player ──

  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function loadSong(index) {
    if (index < 0 || index >= songs.length) return;
    currentIndex = index;
    const song = songs[index];
    playerTitle.textContent = song.title;
    player.classList.remove('hidden');
    
    // Highlight active song
    qsa('.pl-song-row.active').forEach(el => el.classList.remove('active'));
    const row = qs(`[data-song-id="${song.id}"]`);
    if (row) row.classList.add('active');
    
    // Update favorite button
    updateFavBtn(song);
    
    // Update download link
    playerDlBtn.onclick = () => {
      window.location.href = '/api/playlist/songs/' + song.id + '/download';
    };
    
    // Create audio
    if (audio) {
      audio.pause();
      audio.remove();
    }
    audio = new Audio('/api/playlist/songs/' + song.id + '/mp3');
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', () => {
      progressTotal.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('ended', () => playNext());
    audio.addEventListener('error', () => {
      showToast('Gagal memuat lagu. Coba lagi.');
    });
    
    if (isPlaying) {
      audio.play().catch(() => { isPlaying = false; updatePlayBtn(); });
    }
    updatePlayBtn();
    
    // Update lyrics panel
    updateLyrics(song);
  }

  function togglePlay() {
    if (currentIndex < 0 && songs.length > 0) {
      loadSong(0);
      isPlaying = true;
      if (audio) audio.play().catch(() => {});
      updatePlayBtn();
      return;
    }
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play().catch(() => {});
      isPlaying = true;
    }
    updatePlayBtn();
  }

  function playNext() {
    if (songs.length === 0) return;
    const next = (currentIndex + 1) % songs.length;
    isPlaying = true;
    loadSong(next);
  }

  function playPrev() {
    if (songs.length === 0) return;
    // If more than 3 seconds in, restart current song
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prev = (currentIndex - 1 + songs.length) % songs.length;
    isPlaying = true;
    loadSong(prev);
  }

  function updateProgress() {
    if (!audio) return;
    const pct = (audio.currentTime / (audio.duration || 1)) * 100;
    progressFill.style.width = pct + '%';
    progressCurrent.textContent = formatTime(audio.currentTime);
  }

  function updatePlayBtn() {
    if (isPlaying) {
      playerPlayIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    } else {
      playerPlayIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    }
  }

  // ── Lyrics Panel ──
  const lyricsPanel = document.getElementById('pl-lyrics-panel');
  const lyricsText = document.getElementById('pl-lyrics-text');
  const lyricsTitle = document.getElementById('pl-lyrics-title');

  function updateLyrics(song) {
    if (!song || !song.lyrics) {
      if (lyricsPanel) lyricsPanel.style.display = 'none';
      return;
    }
    if (lyricsPanel) lyricsPanel.style.display = 'block';
    if (lyricsTitle) lyricsTitle.textContent = '📝 ' + song.title + ' — Lirik';
    if (lyricsText) {
      // Highlight current line based on time - simple version
      lyricsText.textContent = song.lyrics;
    }
  }

  function updateFavBtn(song) {
    if (!song) return;
    const isFav = song.favorite === true;
    const icon = playerFavBtn.querySelector('svg');
    if (isFav) {
      icon.innerHTML = '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
      playerFavBtn.classList.add('active');
    } else {
      icon.innerHTML = '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>';
      playerFavBtn.classList.remove('active');
    }
  }

  // ── Progress bar click ──
  progressBar.addEventListener('click', (e) => {
    if (!audio || !audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  // ── Volume ──
  let volume = 0.7;
  volBar.addEventListener('click', (e) => {
    const rect = volBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    volume = pct;
    volFill.style.width = (pct * 100) + '%';
    if (audio) audio.volume = pct;
  });

  volBtn.addEventListener('click', () => {
    if (volume > 0) {
      volume = 0;
      volFill.style.width = '0%';
      if (audio) audio.volume = 0;
      volBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd"/><path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>';
    } else {
      volume = 0.7;
      volFill.style.width = '70%';
      if (audio) audio.volume = 0.7;
      volBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>';
    }
  });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') playNext();
    if (e.code === 'ArrowLeft') playPrev();
  });

  // ── Player buttons ──
  playerPlayBtn.addEventListener('click', togglePlay);
  playerPrevBtn.addEventListener('click', playPrev);
  playerNextBtn.addEventListener('click', playNext);

  playerFavBtn.addEventListener('click', async () => {
    if (currentIndex < 0) return;
    const song = songs[currentIndex];
    try {
      const res = await fetch('/api/playlist/favorites/' + song.id, { method: 'POST' });
      const data = await res.json();
      song.favorite = data.favorite;
      updateFavBtn(song);
      // Update all favorite buttons for this song
      qsa('.pl-song-row-btn.fav[data-song-id="' + song.id + '"]').forEach(btn => {
        btn.classList.toggle('active', data.favorite);
      });
      showToast(data.favorite ? 'Ditambahkan ke Favorit' : 'Dihapus dari Favorit');
    } catch(e) {
      showToast('Gagal update favorit');
    }
  });

  // ── Tabs ──
  function switchTab(tab) {
    qsa('.pl-tab').forEach(t => t.classList.remove('active'));
    qsa('.pl-tab-content').forEach(c => c.style.display = 'none');
    const tabEl = qs('.pl-tab[data-tab="' + tab + '"]');
    if (tabEl) tabEl.classList.add('active');
    const content = $('pl-tab-' + tab);
    if (content) content.style.display = 'block';
  }

  qsa('.pl-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // ── Search ──
  const searchInput = $('pl-search-input');
  const searchResults = $('pl-search-results');

  if (searchInput) {
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      if (q.length < 2) { searchResults.classList.remove('show'); return; }
      searchTimer = setTimeout(async () => {
        try {
          const res = await fetch('/api/playlist/songs/search?q=' + encodeURIComponent(q));
          const data = await res.json();
          if (data.length === 0) {
            searchResults.innerHTML = '<div class="pl-search-item" style="color:var(--pl-muted);cursor:default;">Tidak ada hasil</div>';
          } else {
            searchResults.innerHTML = data.map(s => 
              '<div class="pl-search-item" data-song-id="' + s.id + '">' +
                '<div>' +
                  '<div class="pl-search-item-title">' + escHtml(s.title) + '</div>' +
                  (s.lyrics ? '<div class="pl-search-item-sub">' + truncate(s.lyrics, 60) + '</div>' : '') +
                '</div>' +
              '</div>'
            ).join('');
            qsa('.pl-search-item').forEach(el => {
              el.addEventListener('click', () => {
                const idx = songs.findIndex(s => s.id === el.dataset.songId);
                if (idx >= 0) {
                  isPlaying = true;
                  loadSong(idx);
                }
                searchResults.classList.remove('show');
                searchInput.value = '';
              });
            });
          }
          searchResults.classList.add('show');
        } catch(e) { searchResults.classList.remove('show'); }
      }, 300);
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.remove('show');
      }
    });
  }

  // ── Helpers ──
  function escHtml(s) {
    const div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
  }

  function truncate(s, max) {
    if (!s || s.length <= max) return s || '';
    return s.substring(0, max) + '...';
  }

  // ── Play Song (from cards/rows) ──
  window.playSong = function(id) {
    const idx = songs.findIndex(s => s.id === id);
    if (idx >= 0) {
      isPlaying = true;
      loadSong(idx);
    }
  };

  // ── Toggle Favorite (from cards/rows) ──
  window.toggleFav = async function(id, btn) {
    try {
      const res = await fetch('/api/playlist/favorites/' + id, { method: 'POST' });
      const data = await res.json();
      const song = songs.find(s => s.id === id);
      if (song) song.favorite = data.favorite;
      btn.classList.toggle('active', data.favorite);
      // Update player button if current song
      if (currentIndex >= 0 && songs[currentIndex] && songs[currentIndex].id === id) {
        updateFavBtn(songs[currentIndex]);
      }
      showToast(data.favorite ? 'Ditambahkan ke Favorit' : 'Dihapus dari Favorit');
    } catch(e) {
      showToast('Gagal update favorit');
    }
  };

  // ── Add to Playlist ──
  window.addToPlaylist = function(songId) {
    const modal = $('pl-playlist-modal');
    const list = $('pl-playlist-list');
    if (!modal || !list) return;
    
    fetch('/api/playlist/playlists').then(r => r.json()).then(playlists => {
      if (playlists.length === 0) {
        list.innerHTML = '<div style="color:var(--pl-muted);padding:10px 0;">Belum ada playlist. Buat playlist dulu!</div>';
      } else {
        list.innerHTML = playlists.map(p => 
          '<div class="pl-modal-item" data-pl-id="' + p.id + '">' +
            '<span class="pl-modal-item-name">' + escHtml(p.name) + '</span>' +
            '<span style="font-size:12px;color:var(--pl-muted);">' + (p.songCount || 0) + ' lagu</span>' +
          '</div>'
        ).join('');
        qsa('.pl-modal-item').forEach(el => {
          el.addEventListener('click', async () => {
            const plId = el.dataset.plId;
            try {
              const res = await fetch('/api/playlist/playlists/' + plId + '/songs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ songId })
              });
              const data = await res.json();
              if (data.ok) {
                showToast('Ditambahkan ke playlist');
                modal.classList.remove('show');
              }
            } catch(e) {
              showToast('Gagal menambahkan');
            }
          });
        });
      }
      modal.classList.add('show');
    }).catch(() => showToast('Gagal memuat playlist'));
  };

  // ── Close modal ──
  document.addEventListener('click', (e) => {
    const modal = $('pl-playlist-modal');
    if (modal && e.target === modal) modal.classList.remove('show');
  });

  // ── Create Playlist ──
  window.createPlaylist = async function() {
    const input = $('pl-new-pl-name');
    const name = input.value.trim();
    if (!name) { showToast('Nama playlist wajib diisi'); return; }
    try {
      const res = await fetch('/api/playlist/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.ok) {
        input.value = '';
        showToast('Playlist "' + name + '" dibuat');
        // Reload playlist UI
        loadPlaylists();
      }
    } catch(e) {
      showToast('Gagal membuat playlist');
    }
  };

  // ── Load playlists ──
  async function loadPlaylists() {
    const grid = $('pl-playlist-grid');
    if (!grid) return;
    try {
      const res = await fetch('/api/playlist/playlists');
      const data = await res.json();
      if (data.length === 0) {
        grid.innerHTML = '<div class="pl-empty"><p>Belum ada playlist. Buat playlist baru di atas!</p></div>';
      } else {
        grid.innerHTML = data.map(p => 
          '<div class="pl-playlist-card" data-pl-id="' + p.id + '">' +
            '<div class="pl-playlist-card-name">' + escHtml(p.name) + '</div>' +
            '<div class="pl-playlist-card-count">' + (p.songCount || 0) + ' lagu</div>' +
            '<button class="pl-song-row-btn" onclick="deletePlaylist(\'' + p.id + '\')" title="Hapus playlist">🗑️</button>' +
          '</div>'
        ).join('');
        qsa('.pl-playlist-card').forEach(card => {
          card.addEventListener('click', async (e) => {
            if (e.target.closest('button')) return;
            const plId = card.dataset.plId;
            try {
              const res = await fetch('/api/playlist/playlists/' + plId + '/songs');
              const plSongs = await res.json();
              if (plSongs.length === 0) {
                showToast('Playlist kosong');
                return;
              }
              songs = plSongs;
              isPlaying = true;
              loadSong(0);
              showToast('Memutar playlist: ' + (card.querySelector('.pl-playlist-card-name')?.textContent || ''));
            } catch(e) {
              showToast('Gagal memuat playlist');
            }
          });
        });
      }
    } catch(e) {}
  }

  window.deletePlaylist = async function(id) {
    if (!confirm('Hapus playlist ini?')) return;
    try {
      await fetch('/api/playlist/playlists/' + id, { method: 'DELETE' });
      showToast('Playlist dihapus');
      loadPlaylists();
    } catch(e) {
      showToast('Gagal menghapus playlist');
    }
  };

  // ── Expose setSongs for EJS data ──
  window.setSongs = function(data) {
    songs = data;
  };

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    // Use server-rendered songs if available
    if (window.__playlistSongs && Array.isArray(window.__playlistSongs)) {
      songs = window.__playlistSongs;
    }
    // Load initial playlists
    loadPlaylists();
  });

})();
