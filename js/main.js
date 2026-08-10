/* ========================================
   A77SATTA - Main JavaScript & Dynamic Live Data Engine
   ======================================== */

(function() {
  'use strict';

  // Live Clock & Date Ticking
  function updateClock() {
    const now = new Date();
    const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true };
    const formattedDate = now.toLocaleDateString('en-US', dateOptions);
    const formattedTime = now.toLocaleTimeString('en-US', timeOptions);
    const dateStr = `${formattedDate} ${formattedTime}`;

    const topDateEl = document.getElementById('live-date-str');
    if (topDateEl) topDateEl.textContent = dateStr;
  }

  updateClock();
  setInterval(updateClock, 1000);
  document.addEventListener('DOMContentLoaded', updateClock);

  // Fetch Site Data & Render Homepage Dynamically
  async function loadFullSiteData() {
    try {
      const res = await fetch('/api/site-data');
      if (!res.ok) return;
      const data = await res.json();

      // 1. Settings (Ticker, Hindi tagline, Links, Notices)
      if (data.settings) {
        const s = data.settings;
        
        // Marquee ticker
        const marquee = document.querySelector('.sub-nav-ticker marquee');
        if (marquee && s.ticker_text) marquee.textContent = s.ticker_text;

        // Hindi tagline
        const tagline = document.querySelector('.result-text');
        if (tagline && s.hindi_tagline) tagline.textContent = s.hindi_tagline;

        // Notices
        const notice1 = document.querySelector('.a77-status-row:not(.a77-status-row-large) span');
        if (notice1 && s.notice_1) notice1.textContent = s.notice_1;

        const notice2 = document.querySelector('.a77-status-row.a77-status-row-large span');
        if (notice2 && s.notice_2) notice2.textContent = s.notice_2;

        // WhatsApp / Telegram links
        if (s.telegram_url) {
          document.querySelectorAll('.telegram-button').forEach(el => el.href = s.telegram_url);
        }
        if (s.whatsapp_url) {
          document.querySelectorAll('.whatsapp-button, .whatsapp-cta-small').forEach(el => el.href = s.whatsapp_url);
        }
      }

      // 2. Games Tables Sync
      if (data.games && data.games.length > 0) {
        const group1 = data.games.filter(g => g.table_group === 1 || !g.table_group);
        const group2 = data.games.filter(g => g.table_group === 2);

        // Render Upper Live Table 1
        const board1 = document.querySelector('.a77-market-board');
        if (board1 && group1.length > 0) {
          let rowsHtml = `
            <div class="a77-market-board-header">
              <div>सट्टा का नाम</div>
              <div>कल आया था</div>
              <div>आज का रिजल्ट</div>
            </div>
          `;
          group1.forEach(g => {
            const todayRes = g.today_result === 'WAIT' || !g.today_result
              ? `<span class="market-wait">WAIT</span>`
              : g.today_result;

            rowsHtml += `
              <div class="a77-market-row">
                <div class="market-title">${g.name}<br><span>${g.open_time || ''}</span></div>
                <div class="market-cell">${g.yesterday_result || '-'}</div>
                <div class="market-cell market-result">${todayRes}</div>
              </div>
            `;
          });
          board1.innerHTML = rowsHtml;
        }

        // Render Lower Live Table 2
        const board2 = document.querySelector('.a77-results-dashboard');
        if (board2 && group2.length > 0) {
          let rowsHtml = `
            <div class="a77-dashboard-header">
              <div>सट्टा का नाम</div>
              <div>कल आया था</div>
              <div>आज का रिजल्ट</div>
            </div>
          `;
          group2.forEach(g => {
            const todayRes = g.today_result === 'WAIT' || !g.today_result
              ? `<span class="wait-star-yellow">WAIT</span>`
              : g.today_result;

            rowsHtml += `
              <div class="a77-dashboard-row">
                <div class="dashboard-game">${g.name}<br><span>${g.open_time || ''}</span></div>
                <div class="dashboard-value">${g.yesterday_result || '-'}</div>
                <div class="dashboard-value dashboard-result">${todayRes}</div>
              </div>
            `;
          });
          board2.innerHTML = rowsHtml;
        }
      }

      // 3. Record Chart Tables Sync
      if (data.chart_records && data.chart_records.length > 0) {
        const recordsMap = {};
        const datesSet = new Set(['01-08', '02-08', '03-08', '04-08', '05-08', '06-08', '07-08', '08-08', '09-08']);
        
        data.chart_records.forEach(r => {
          recordsMap[`${r.record_date}_${r.game_name}`] = r.result_val;
          datesSet.add(r.record_date);
        });

        const dates = Array.from(datesSet).sort();

        // Table 1 (Main 12 Games)
        const table1Tbody = document.querySelector('.lower-stat-table-wrap:first-of-type table tbody');
        if (table1Tbody) {
          const mainGames = ['SADAR BAZAR', 'GWALIOR', 'DELHI BAZAR', 'DELHI MATKA', 'SHRI GANESH', 'AGRA', 'FARIDABAD', 'ALWAR', 'GAZIABAD', 'DWARKA', 'GALI', 'DISAWER'];
          let html = '';
          dates.forEach(d => {
            html += `<tr><td>${d}</td>`;
            mainGames.forEach(g => {
              html += `<td>${recordsMap[`${d}_${g}`] || '-'}</td>`;
            });
            html += `</tr>`;
          });
          table1Tbody.innerHTML = html;
        }

        // Table 2 (20 Lower Games)
        const table2Tbody = document.querySelector('.lower-stat-table-wrap:last-of-type table tbody');
        if (table2Tbody) {
          const lowerGames = [
            'HR SATTA', 'UJJALA SUPER', 'KKR CITY', 'MADHUPURI', 'ANMOL BAZAR', 'KAROL BAGH',
            'DELHI DARBAR', 'NEW GANGA', 'SKY KING', 'FATEHABAD', 'UDAIPUR CITY', 'RAJ SHREE',
            'VIP AGRA', 'MOHALI-7', 'BHADRA BAZAR', 'MANDI BAZAR', 'LION BAZAR', 'SIALKOT',
            'DEHRADUN CITY', 'DAMAN'
          ];
          let html = '';
          dates.forEach(d => {
            html += `<tr><td>${d}</td>`;
            lowerGames.forEach(g => {
              html += `<td>${recordsMap[`${d}_${g}`] || '-'}</td>`;
            });
            html += `</tr>`;
          });
          table2Tbody.innerHTML = html;
        }
      }

      // 4. Blogs Sync
      if (data.blogs && data.blogs.length > 0) {
        const blogLayout = document.querySelector('.a77-blog-layout');
        if (blogLayout) {
          let html = '';
          data.blogs.forEach(b => {
            const tagSpans = (b.tags || '').split(' ').map(t => `<a href="#">${t}</a>`).join(' ');
            html += `
              <article class="a77-blog-card">
                <a href="#" class="a77-blog-image-link">
                  <img class="a77-blog-image" src="${b.image || 'images/logo.png'}" alt="${b.title}">
                </a>
                <div class="a77-blog-card-body">
                  <div class="a77-blog-card-title"><a href="#">${b.title}</a></div>
                  <div class="a77-blog-card-date">${b.post_date || 'Recently Posted'}</div>
                  <div class="a77-blog-tags">${tagSpans}</div>
                </div>
              </article>
            `;
          });
          blogLayout.innerHTML = html;
        }
      }

    } catch (e) {
      console.log('API sync offline or fallback active');
    }
  }

  document.addEventListener('DOMContentLoaded', loadFullSiteData);
  setInterval(loadFullSiteData, 15000);

  // Floating Refresh Button Event Listener
  document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('spinning');
        loadFullSiteData();
        setTimeout(() => {
          refreshBtn.classList.remove('spinning');
        }, 700);
      });
    }
  });

})();
