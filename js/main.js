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

    document.querySelectorAll('#live-date-str, .live-date-str, .date-line').forEach(el => {
      el.textContent = dateStr;
    });
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

  window.latestSiteData = null;

  const yearlySampleDataGlobal = [
    [27, 79, 60, 53, 16, 76, 55, 55, '-', '-', '-', '-'],
    [55, 69, 42, 44, 72, 10, 46, 16, '-', '-', '-', '-'],
    [59, 58, 49, 50, 54, 77, 83, 10, '-', '-', '-', '-'],
    [86, 34, 55, 78, 98, 20, 22, 21, '-', '-', '-', '-'],
    [92, 11, 45, 56, 65, 24, 14, 13, '-', '-', '-', '-'],
    [98, 53, '00', 14, 68, 78, 40, 93, '-', '-', '-', '-'],
    [27, 63, '01', 45, 47, 72, 43, 63, '-', '-', '-', '-'],
    [95, 36, 34, 46, 44, 91, 42, 55, '-', '-', '-', '-'],
    [44, 40, 46, 97, 45, 20, 49, 43, '-', '-', '-', '-'],
    [56, 33, 85, 78, 35, 38, 60, '-', '-', '-', '-', '-'],
    [56, 65, 23, 21, 13, 55, 99, '-', '-', '-', '-', '-'],
    [64, 44, 33, 11, 88, 75, 50, '-', '-', '-', '-', '-'],
    [22, 44, 66, 64, 55, 68, 25, '-', '-', '-', '-', '-'],
    [43, 49, 44, 23, 60, 45, 23, '-', '-', '-', '-', '-'],
    [42, 11, 55, 54, '09', 50, 62, '-', '-', '-', '-', '-'],
    [31, 22, 89, 16, 58, 29, '06', 42, '-', '-', '-', '-'],
    ['05', 80, 53, 56, 31, 73, 95, 59, '-', '-', '-', '-'],
    [99, '01', 12, 67, 10, 78, 12, 34, '-', '-', '-', '-'],
    [24, 60, 47, 19, 75, 76, 57, 56, '-', '-', '-', '-'],
    [95, 21, 61, 16, 97, 48, 22, 24, '-', '-', '-', '-'],
    [48, 15, 52, 27, 80, '02', 26, '09', '-', '-', '-', '-'],
    [30, 47, 91, 45, 93, 18, 81, 20, '-', '-', '-', '-'],
    [35, 87, 89, '07', 74, 39, 63, 82, '-', '-', '-', '-'],
    [71, 12, 69, '00', 76, 59, 57, '08', '-', '-', '-', '-'],
    [93, 18, 88, '05', 42, 20, 74, 94, '-', '-', '-', '-'],
    [73, 92, 33, 45, 39, 64, 78, 64, '-', '-', '-', '-'],
    [60, 31, '03', 71, 84, 25, 18, 18, '-', '-', '-', '-'],
    [59, 45, 86, 21, 67, 99, 69, 54, '-', '-', '-', '-'],
    [54, 10, 78, 29, 17, 71, 13, 51, '-', '-', '-', '-'],
    [66, 82, 52, '01', '01', 70, 92, 74, '-', '-', '-', '-'],
    [15, 88, 34, 90, 27, 52, 61, 19, '-', '-', '-', '-']
  ];

  function buildTableMarkupGlobal(name, chartRecords) {
    const cleanName = name.replace('SATTA KING CHART', '').replace('CHART 2026', '').replace('CHART', '').trim();
    let tableRows = yearlySampleDataGlobal;

    if (chartRecords && Array.isArray(chartRecords)) {
      const fullDateMap = {};
      chartRecords.forEach(r => {
        if (!r || !r.record_date || !r.game_name) return;
        const gUpper = r.game_name.trim().toUpperCase();
        const cUpper = cleanName.trim().toUpperCase();
        if (gUpper === cUpper || (gUpper === 'DISAWER' && cUpper === 'DESAWAR') || (gUpper === 'DESAWAR' && cUpper === 'DISAWER')) {
          const parts = r.record_date.trim().split('-');
          if (parts.length === 2) {
            const dayNum = parseInt(parts[0], 10);
            const monthNum = parseInt(parts[1], 10);
            if (!isNaN(dayNum) && !isNaN(monthNum)) {
              fullDateMap[`${monthNum}_${dayNum}`] = r.result_val;
            }
          }
        }
      });

      tableRows = yearlySampleDataGlobal.map((row, dayIdx) => {
        const dayNum = dayIdx + 1;
        const newRow = [...row];
        for (let monthNum = 1; monthNum <= 12; monthNum++) {
          const key = `${monthNum}_${dayNum}`;
          if (fullDateMap[key] !== undefined) {
            newRow[monthNum - 1] = fullDateMap[key];
          }
        }
        return newRow;
      });
    }

    return `
      <div class="yearly-chart-modal-banner">
        ${cleanName} YEARLY CHART 2026
      </div>
      <div class="table-scroll-wrapper">
        <table class="satta-yearly-chart-table">
          <thead>
            <tr>
              <th>2026</th>
              <th>JAN</th><th>FEB</th><th>MAR</th><th>APR</th><th>MAY</th><th>JUN</th>
              <th>JUL</th><th>AUG</th><th>SEP</th><th>OCT</th><th>NOV</th><th>DEC</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.map((row, idx) => `
              <tr>
                <td class="day-col">${idx + 1}</td>
                ${row.map(val => `<td class="val-col">${val}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  window.openChartForGameName = function(gameName) {
    if (!gameName) return;
    const cleanName = gameName.trim().toUpperCase();
    const fullName = `${cleanName} SATTA KING CHART 2026`;
    const modal = document.getElementById('chartModalOverlay');
    const modalTitle = document.getElementById('modalChartTitle');
    const modalBody = document.getElementById('chartModalBody');

    if (modal && modalBody) {
      if (modalTitle) modalTitle.textContent = fullName;
      const records = (window.latestSiteData && window.latestSiteData.chart_records) ? window.latestSiteData.chart_records : [];
      modalBody.innerHTML = buildTableMarkupGlobal(fullName, records);
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    } else {
      window.location.href = 'chart.html?game=' + encodeURIComponent(cleanName);
    }
  };

  document.addEventListener('click', function(e) {
    const closeBtn = e.target.closest('#chartModalClose');
    const modal = document.getElementById('chartModalOverlay');
    if (closeBtn && modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    } else if (e.target === modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  function renderSiteData(data) {
    if (!data) return;
    window.latestSiteData = data;

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
            if (typeof window.openChartForGameName === 'function') {
              window.openChartForGameName(val);
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

        // Render Dynamic Khaiwal Cards Grid (Directly from Admin DB Settings)
        const khaiwalGrid = document.getElementById('khaiwalGridContainer');
        if (khaiwalGrid) {
          let cardList = [];
          if (s.khaiwal_cards_json) {
            try {
              cardList = typeof s.khaiwal_cards_json === 'string' ? JSON.parse(s.khaiwal_cards_json) : s.khaiwal_cards_json;
            } catch(e) {}
          }

          if (Array.isArray(cardList) && cardList.length > 0) {
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
      }

      // Render Main Hero Box Games (Dynamic Stack from Table 1)
      const heroContainer = document.getElementById('heroGamesList');
      if (heroContainer) {
        let heroList = (data.games || []).filter(g => parseInt(g.is_hero) === 1);
        if (!heroList || heroList.length === 0) {
          if (data.settings && data.settings.hero_games_json) {
            try {
              const parsed = typeof data.settings.hero_games_json === 'string'
                ? JSON.parse(data.settings.hero_games_json)
                : data.settings.hero_games_json;
              if (Array.isArray(parsed) && parsed.length > 0) heroList = parsed;
            } catch(e) {}
          }
        }
        if (!heroList || heroList.length === 0) {
          if (Array.isArray(data.hero_games) && data.hero_games.length > 0) {
            heroList = data.hero_games;
          }
        }
        if (!heroList || heroList.length === 0) {
          heroList = (data.games || []).slice(0, 2);
        }

        let heroHtml = '';
        heroList.forEach(g => {
          const name = g.name ? g.name.trim().toUpperCase() : 'GAME';

          const matchedGame = (data.games || []).find(mg => {
            const mgName = (mg.name || '').trim().toUpperCase();
            return mgName === name || (name.startsWith('DISAW') && mgName.startsWith('DISAW'));
          }) || {};

          const chartTodayVal = getResultFromChartRecords(chartRecords, todayStr, name);
          
          let resVal = 'WAIT';
          if (g.today_result && g.today_result.trim() !== '' && g.today_result !== 'WAIT') {
            resVal = g.today_result.trim();
          } else if (matchedGame.today_result && matchedGame.today_result.trim() !== '' && matchedGame.today_result !== 'WAIT') {
            resVal = matchedGame.today_result.trim();
          } else if (chartTodayVal !== null && chartTodayVal !== undefined && chartTodayVal !== '') {
            resVal = chartTodayVal.trim();
          }

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

      // Render Featured Yellow Banner Game (Bottom Disclaimer Box from Table 1)
      const bannerBox = document.getElementById('featuredBannerBox') || document.querySelector('.bottom-disclaimer');
      if (bannerBox) {
        const selectedBannerGameName = (data.settings && data.settings.featured_banner_game)
          ? data.settings.featured_banner_game.trim().toUpperCase()
          : 'DISAWER';

        const gameConfig = (data.games || []).find(g => parseInt(g.is_featured) === 1) ||
                           (data.games || []).find(g => {
                             const gName = (g.name || '').trim().toUpperCase();
                             return gName === selectedBannerGameName ||
                                    (selectedBannerGameName.startsWith('DISAW') && gName.startsWith('DISAW'));
                           }) || {
                             name: 'DISAWER',
                             open_time: '5:15 AM',
                             yesterday_result: '16',
                             today_result: 'WAIT'
                           };

        const actualGameName = (gameConfig.name || 'DISAWER').trim().toUpperCase();
        const settings = data.settings || {};

        const bannerTime = (gameConfig.open_time && gameConfig.open_time.trim()) ? gameConfig.open_time : (settings.disawer_time || '5:15 AM');

        let finalYest = (gameConfig.yesterday_result && gameConfig.yesterday_result !== '-' && gameConfig.yesterday_result.trim())
          ? gameConfig.yesterday_result
          : (settings.disawer_prev && settings.disawer_prev !== '-' ? settings.disawer_prev : '-');

        let finalToday = (gameConfig.today_result && gameConfig.today_result !== 'WAIT' && gameConfig.today_result.trim())
          ? gameConfig.today_result
          : (settings.disawer_today && settings.disawer_today !== 'WAIT' ? settings.disawer_today : 'WAIT');

        if (finalYest === '-' || !finalYest) {
          const chartYestVal = getResultFromChartRecords(chartRecords, yestStr, actualGameName);
          if (chartYestVal) finalYest = chartYestVal;
        }

        if (finalToday === 'WAIT' || !finalToday) {
          const chartTodayVal = getResultFromChartRecords(chartRecords, todayStr, actualGameName);
          if (chartTodayVal) finalToday = chartTodayVal;
        }

        const todayHtml = (!finalToday || finalToday === 'WAIT')
          ? `<span class="wait-starburst-badge">WAIT</span>`
          : `<span class="score-number score-number-today">${finalToday}</span>`;

        bannerBox.innerHTML = `
          <div class="bottom-title">${actualGameName}</div>
          <div class="bottom-time">${bannerTime}</div>
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

            const yestRes = (g.yesterday_result && g.yesterday_result !== '-' && g.yesterday_result.trim())
              ? g.yesterday_result.trim()
              : (chartYestVal !== null ? chartYestVal : '-');

            const todayRaw = (g.today_result && g.today_result !== 'WAIT' && g.today_result.trim())
              ? g.today_result.trim()
              : (chartTodayVal !== null ? chartTodayVal : (g.today_result || 'WAIT'));

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
