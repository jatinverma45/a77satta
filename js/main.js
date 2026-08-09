/* ========================================
   A77SATTA - Main JavaScript (Live Realtime Ticking Clock)
   ======================================== */

(function() {
  'use strict';

  // ========================================
  // Live Clock & Date (IST / Local Live Ticking)
  // ========================================
  function updateClock() {
    const now = new Date();
    const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true };
    const formattedDate = now.toLocaleDateString('en-US', dateOptions);
    const formattedTime = now.toLocaleTimeString('en-US', timeOptions);
    const dateStr = `${formattedDate} ${formattedTime}`;

    const topDateEl = document.getElementById('live-date-str');
    if (topDateEl) topDateEl.textContent = dateStr;

    const clockEl = document.getElementById('live-clock');
    const dateEl = document.getElementById('live-date');
    if (clockEl) clockEl.textContent = formattedTime;
    if (dateEl) dateEl.textContent = formattedDate;
  }

  // Run updateClock immediately and tick every 1 second continuously
  updateClock();
  setInterval(updateClock, 1000);
  document.addEventListener('DOMContentLoaded', updateClock);
  window.addEventListener('load', updateClock);

  // ========================================
  // Fetch live data from API
  // ========================================
  async function loadGamesFromAPI() {
    try {
      const res = await fetch('/api/games');
      if (!res.ok) return;
      const games = await res.json();

      // Update games row
      const gamesRow = document.getElementById('games-row');
      if (gamesRow) {
        gamesRow.innerHTML = '';
        games.forEach(game => {
          const row = document.createElement('div');
          row.className = 'game-row';
          row.innerHTML = `
            <span class="game-name">${game.name}</span>
            <span class="game-time">${game.open_time || '-'} - ${game.close_time || '-'}</span>
            <span class="game-result">${game.result_number ? game.result_number : '***-**'}</span>
          `;
          gamesRow.appendChild(row);
        });
      }

      // Update main result box
      const mainResult = document.getElementById('main-result');
      if (mainResult && games.length > 0 && games[0].result_number) {
        mainResult.textContent = games[0].result_number;
        const resStatus = document.querySelector('.result-status-main');
        if (resStatus) resStatus.textContent = 'Result Declared';
      }

      // Update games grid
      const grid = document.getElementById('games-grid');
      if (grid) {
        grid.innerHTML = '';
        games.forEach(game => {
          const card = document.createElement('div');
          card.className = 'game-card';
          card.innerHTML = `
            <div class="game-card-img">
              <img src="images/${game.image}" alt="${game.name}" onerror="this.src='images/logo.png'">
              <span class="game-card-badge">${game.badge || 'Hot'}</span>
            </div>
            <div class="game-card-body">
              <div class="game-card-title">${game.name}</div>
              <div class="game-card-meta">
                <span>Open: ${game.open_time || '-'}</span>
                <span>Close: ${game.close_time || '-'}</span>
              </div>
              <div class="game-card-result">
                <span class="label">TODAY'S RESULT</span>
                <span class="number">${game.result_number ? game.result_number : '***'}</span>
              </div>
            </div>
          `;
          grid.appendChild(card);
        });
      }
    } catch (e) {
      // API fallback
    }
  }

  async function loadResultsFromAPI() {
    try {
      const res = await fetch('/api/games');
      if (!res.ok) return;
      const games = await res.json();
      const tbody = document.getElementById('results-table-body');
      if (tbody) {
        tbody.innerHTML = '';
        games.forEach(game => {
          if (game.result_number) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${game.name}</strong></td>
              <td class="date">${formatDate(game.result_date)}</td>
              <td class="number">${game.result_number}</td>
              <td class="win">${game.status || 'Declared'}</td>
            `;
            tbody.appendChild(tr);
          }
        });
      }
    } catch (e) {
      // API fallback
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Load API data on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    loadGamesFromAPI();
    loadResultsFromAPI();
  });

  // Refresh API data every 30 seconds
  setInterval(() => {
    loadGamesFromAPI();
    loadResultsFromAPI();
  }, 30000);

  // Floating Refresh Button Event Listener
  document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('spinning');
        loadGamesFromAPI();
        loadResultsFromAPI();
        setTimeout(() => {
          refreshBtn.classList.remove('spinning');
        }, 700);
      });
    }
  });

})();
