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

  function getAutoDatesUpToToday() {
    const dates = [];
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    for (let d = 1; d <= currentDay; d++) {
      const dayStr = String(d).padStart(2, '0');
      dates.push(`${dayStr}-${currentMonth}`);
    }
    return dates;
  }

  // Fetch Site Data & Render Homepage Dynamically
  // Fetch Site Data & Render Homepage Dynamically
  async function loadFullSiteData() {
    // 1. Instant local render from cache if available
    try {
      const cached = localStorage.getItem('a77satta_site_cache_v6');
      if (cached) renderSiteData(JSON.parse(cached));
    } catch(e) {}

    // 2. Fetch fresh live data from server
    try {
      const res = await fetch('/api/site-data?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      try { localStorage.setItem('a77satta_site_cache_v6', JSON.stringify(data)); } catch(e) {}
      renderSiteData(data);
    } catch(e) {
      console.log('API sync offline or fallback active');
    }
  }

  function renderSiteData(data) {
    if (!data) return;

      const chartRecords = data.chart_records || [];
      const nowDate = new Date();
      const currentMonthStr = String(nowDate.getMonth() + 1).padStart(2, '0');
      const todayDay = nowDate.getDate();
      const yestDay = todayDay - 1;
      const todayStr = `${String(todayDay).padStart(2, '0')}-${currentMonthStr}`;
      const yestStr = yestDay > 0 ? `${String(yestDay).padStart(2, '0')}-${currentMonthStr}` : todayStr;

      function getResultFromChartRecords(records, dateStr, gameName) {
        if (!records || !records.length || !dateStr || !gameName) return null;
        const gUpper = gameName.trim().toUpperCase();
        const rec = records.find(r => {
          if (!r.record_date || !r.game_name) return false;
          const rDate = r.record_date.trim();
          const rGame = r.game_name.trim().toUpperCase();
          return rDate === dateStr && (rGame === gUpper || (gUpper === 'DISAWER' && rGame === 'DESAWAR') || (gUpper === 'DESAWAR' && rGame === 'DISAWER'));
        });
        return rec ? rec.result_val : null;
      }

      // Populate Search Filter Dropdown (#gameSelect) with Table 1 Games
      const gameSelectEl = document.getElementById('gameSelect');
      if (gameSelectEl && data.games && data.games.length > 0) {
        const currentSelected = gameSelectEl.value;
        let optsHtml = '';
        data.games.forEach(g => {
          const gName = (g.name || '').trim().toUpperCase();
          if (gName) {
            optsHtml += `<option value="${gName}">${gName}</option>`;
          }
        });
        gameSelectEl.innerHTML = optsHtml;
        if (currentSelected && Array.from(gameSelectEl.options).some(o => o.value === currentSelected)) {
          gameSelectEl.value = currentSelected;
        }
      }

      document.querySelectorAll('.filter-check-btn').forEach(btn => {
        btn.onclick = () => {
          const sel = document.getElementById('gameSelect');
          if (sel && sel.value) {
            const val = sel.value.trim();
            if (window.location.pathname.includes('chart.html')) {
              if (typeof openChartForGameName === 'function') {
                openChartForGameName(val);
              }
            } else {
              window.location.href = 'chart.html?game=' + encodeURIComponent(val);
            }
          }
        };
      });

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

        // Render Dynamic Notice Banners
        const noticeWrap = document.getElementById('noticeBannersContainer');
        if (noticeWrap) {
          let noticeList = [];
          if (s.notice_banners_json) {
            try { noticeList = JSON.parse(s.notice_banners_json); } catch(e) {}
          }
          if (!noticeList || noticeList.length === 0) {
            noticeList = [
              { text: s.notice_1 || 'SHRI GANESH SATTA KING RESULT IS UPDATED EVERYDAY AT 4:40 PM.' },
              { text: s.notice_2 || 'SADAR BAZAR SATTA KING 2026 CHART IS AVAILABLE ON A77SATTA.COM' }
            ];
          }
          let noticeHtml = '';
          noticeList.forEach((n, idx) => {
            const isLarge = idx % 2 === 1 ? 'a77-status-row-large' : '';
            noticeHtml += `
              <section class="a77-status-row ${isLarge}">
                <span>${n.text}</span>
              </section>
            `;
          });
          noticeWrap.innerHTML = noticeHtml;
        }

        // Render Dynamic Khaiwal Cards Grid
        const khaiwalGrid = document.getElementById('khaiwalGridContainer');
        if (khaiwalGrid) {
          let cardList = [];
          if (s.khaiwal_cards_json) {
            try { cardList = JSON.parse(s.khaiwal_cards_json); } catch(e) {}
          }

          let gridHtml = '';
          cardList.forEach(c => {
            const waUrl = c.whatsapp_url || s.whatsapp_url || '#';
            const bodyLines = (c.times_text || '').split('\n').map(line => line.trim()).filter(Boolean).join('<br>\n            ');
            if (c.card_type === 'feature') {
              gridHtml += `
      <article class="schedule-panel feature-card">
        <header class="schedule-header">
          <div class="subtitle-text">${c.header_subtitle || ''}</div>
          <h2 class="bold-header">${c.title || ''}</h2>
        </header>
        <div class="panel-body">
          <p>
            ${bodyLines}
          </p>
          ${c.footer_text ? `<div class="note-box">${c.footer_text}</div>` : ''}
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="cta-banner">
            <span class="cta-glow">▶ GO TO WHATSAPP DIRECT ◀</span>
          </a>
        </div>
      </article>`;
            } else {
              gridHtml += `
      <article class="schedule-panel">
        <header class="schedule-header">
          <div class="subtitle-text">${c.header_subtitle || '--सीधी सट्टा कंपनी का No 1 शर्तावाल--'}</div>
          <h2 class="bold-header">${c.title || ''}</h2>
        </header>
        <div class="panel-body">
          <p>
            ${bodyLines}
          </p>
          <div class="note-box">${c.footer_text || 'Game play करने के लिए नीचे लिंक पर क्लिक करें'}</div>
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="cta-banner">
            <span class="cta-glow">▶ GO TO WHATSAPP DIRECT ◀</span>
          </a>
        </div>
      </article>`;
            }
          });
          khaiwalGrid.innerHTML = gridHtml;
        }
      }

      // Render Main Hero Box Games (Dynamic Stack)
      const heroContainer = document.getElementById('heroGamesList');
      if (heroContainer) {
        let heroList = null;
        if (data.settings && data.settings.hero_games_json) {
          try {
            const parsed = typeof data.settings.hero_games_json === 'string'
              ? JSON.parse(data.settings.hero_games_json)
              : data.settings.hero_games_json;
            if (Array.isArray(parsed) && parsed.length > 0) heroList = parsed;
          } catch(e) {}
        }
        if (!heroList && Array.isArray(data.hero_games) && data.hero_games.length > 0) {
          heroList = data.hero_games;
        }
        if (!heroList) {
          heroList = (data.games || []).filter(g => parseInt(g.is_hero) === 1);
        }

        let heroHtml = '';
        heroList.forEach(g => {
          const name = g.name ? g.name.trim().toUpperCase() : 'GAME';
          const chartTodayVal = getResultFromChartRecords(chartRecords, todayStr, name);
          const resVal = chartTodayVal !== null ? chartTodayVal : (g.today_result ? g.today_result.trim() : (g.result || 'WAIT'));
          const resHtml = (!resVal || resVal === 'WAIT')
            ? `<div class="wait-starburst-badge">WAIT</div>`
            : `<div class="game-result-main">${resVal}</div>`;

          heroHtml += `
            <div class="result-block">
              <div class="game-name-main">${name}</div>
              ${resHtml}
            </div>
          `;
        });
        heroContainer.innerHTML = heroHtml;
      }

      // Render Featured Yellow Banner Game (Bottom Disclaimer Box)
      const bannerBox = document.getElementById('featuredBannerBox') || document.querySelector('.bottom-disclaimer');
      if (bannerBox) {
        const selectedBannerGameName = (data.settings && data.settings.featured_banner_game)
          ? data.settings.featured_banner_game.trim().toUpperCase()
          : 'DISAWER';

        const gameConfig = (data.games || []).find(g => {
          const gName = (g.name || '').trim().toUpperCase();
          return gName === selectedBannerGameName ||
                 (selectedBannerGameName.startsWith('DISAW') && gName.startsWith('DISAW'));
        }) || {
          name: 'DISAWER',
          open_time: '5:15 AM',
          yesterday_result: '16',
          today_result: 'WAIT'
        };

        const actualGameName = gameConfig.name || selectedBannerGameName;
        const chartYestVal = getResultFromChartRecords(chartRecords, yestStr, actualGameName);
        const chartTodayVal = getResultFromChartRecords(chartRecords, todayStr, actualGameName);

        // Priority 1: Table 1 game config (g.yesterday_result / g.today_result)
        // Priority 2: chart_records entry
        let finalYest = gameConfig.yesterday_result;
        if (!finalYest || finalYest === '-') {
          finalYest = (chartYestVal !== null && chartYestVal !== undefined) ? chartYestVal : '-';
        }

        let finalToday = gameConfig.today_result;
        if (!finalToday || finalToday === 'WAIT') {
          finalToday = (chartTodayVal !== null && chartTodayVal !== undefined) ? chartTodayVal : 'WAIT';
        }

        const todayHtml = (!finalToday || finalToday === 'WAIT')
          ? `<span class="wait-starburst-badge">WAIT</span>`
          : `<span class="score-number score-number-today">${finalToday}</span>`;

        bannerBox.innerHTML = `
          <div class="bottom-title">${actualGameName}</div>
          <div class="bottom-time">${gameConfig.open_time || ''}</div>
          <div class="score-row">
            <span class="score-number">${finalYest}</span>
            <span class="green-arrow-pill">➡️</span>
            ${todayHtml}
          </div>
        `;
      }

      // 2. Games Tables Sync
      const board1 = document.querySelector('.a77-market-board');
      if (board1 && data.games && data.games.length > 0) {
        const group1 = data.games.filter(g => parseInt(g.table_group) === 1 || !g.table_group);
        if (group1.length > 0) {
          let rowsHtml = `
            <div class="a77-market-board-header">
              <div>सट्टा का नाम</div>
              <div>कल आया था</div>
              <div>आज का रिजल्ट</div>
            </div>
          `;
          group1.forEach(g => {
            const chartYestVal = getResultFromChartRecords(chartRecords, yestStr, g.name);
            const chartTodayVal = getResultFromChartRecords(chartRecords, todayStr, g.name);

            const yestRes = chartYestVal !== null ? chartYestVal : (g.yesterday_result || '-');
            const todayRaw = chartTodayVal !== null ? chartTodayVal : (g.today_result || 'WAIT');

            const todayResHtml = (!todayRaw || todayRaw === 'WAIT')
              ? `<span class="market-wait">WAIT</span>`
              : todayRaw;

            rowsHtml += `
              <div class="a77-market-row">
                <div class="market-title">${g.name}<br><span>${g.open_time || ''}</span></div>
                <div class="market-cell">${yestRes}</div>
                <div class="market-cell market-result">${todayResHtml}</div>
              </div>
            `;
          });
          board1.innerHTML = rowsHtml;
        }
      }

      // 3. Record Chart Tables Sync
      const recordsMap = {};
      const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
      const datesSet = new Set(getAutoDatesUpToToday());
      
      if (data.chart_records && Array.isArray(data.chart_records)) {
        data.chart_records.forEach(r => {
          if (r.record_date && r.game_name) {
            const key = `${r.record_date.trim()}_${r.game_name.trim().toUpperCase()}`;
            recordsMap[key] = r.result_val;
            const parts = r.record_date.trim().split('-');
            if (parts.length === 2 && parts[1] === currentMonthStr) {
              datesSet.add(r.record_date.trim());
            }
          }
        });
      }

      const dates = Array.from(datesSet).sort((a, b) => {
        const dayA = parseInt(a.split('-')[0], 10) || 0;
        const dayB = parseInt(b.split('-')[0], 10) || 0;
        return dayA - dayB;
      });

        function getVal(date, gameName) {
          const gUpper = gameName.trim().toUpperCase();
          const directKey = `${date}_${gUpper}`;
          if (recordsMap[directKey] !== undefined) return recordsMap[directKey];

          // Fuzzy search fallback for capitalization or variant names
          for (const [k, v] of Object.entries(recordsMap)) {
            const [d, g] = k.split('_');
            if (d === date) {
              if (g === gUpper || (gUpper === 'DISAWER' && g === 'DESAWAR') || (gUpper === 'DESAWAR' && g === 'DISAWER')) {
                return v;
              }
            }
          }

          // Direct fallback to Table 1 games data if chart_records hasn't record for today/yesterday yet
          const gObj = (data.games || []).find(x => (x.name || '').trim().toUpperCase() === gUpper);
          if (gObj) {
            if (date === todayStr && gObj.today_result && gObj.today_result !== 'WAIT') return gObj.today_result;
            if (date === yestStr && gObj.yesterday_result && gObj.yesterday_result !== '-') return gObj.yesterday_result;
          }

          return '-';
        }

        const tableWraps = document.querySelectorAll('.lower-stat-table-wrap');

        // Table 1 (Main Games)
        if (tableWraps.length > 0) {
          let mainGames = ['SADAR BAZAR', 'GWALIOR', 'DELHI BAZAR', 'DELHI MATKA', 'SHRI GANESH', 'AGRA', 'FARIDABAD', 'ALWAR', 'GAZIABAD', 'DWARKA', 'GALI', 'DISAWER'];
          if (data.games && data.games.length > 0) {
            mainGames = data.games.map(g => (g.name || '').trim().toUpperCase()).filter(Boolean);
          } else if (data.settings && data.settings.chart1_columns_json) {
            try {
              const parsed = JSON.parse(data.settings.chart1_columns_json);
              if (Array.isArray(parsed) && parsed.length > 0) mainGames = parsed;
            } catch(e) {}
          }
          const t1Thead = tableWraps[0].querySelector('thead');
          const t1Tbody = tableWraps[0].querySelector('tbody');

          if (t1Thead) {
            t1Thead.innerHTML = `<tr><th>Date</th>${mainGames.map(g => `<th>${g}</th>`).join('')}</tr>`;
          }

          if (t1Tbody) {
            let html = '';
            dates.forEach(d => {
              html += `<tr><td>${d}</td>`;
              mainGames.forEach(g => {
                html += `<td>${getVal(d, g)}</td>`;
              });
              html += `</tr>`;
            });
            t1Tbody.innerHTML = html;
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
    } catch(e) {
      console.log('Error rendering site data:', e);
    }
  }

  // Trigger site data load immediately & on DOM ready
  loadFullSiteData();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFullSiteData);
  }
  setInterval(loadFullSiteData, 10000);

  // Floating Refresh Button Event Listener
  function initRefreshBtn() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        refreshBtn.classList.add('spinning');
        loadFullSiteData();
        setTimeout(() => {
          refreshBtn.classList.remove('spinning');
        }, 700);
      };
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRefreshBtn);
  } else {
    initRefreshBtn();
  }

})();
