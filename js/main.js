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

  // Fetch Site Data & Render Homepage Dynamically (Authoritative Live API)
  let activeFetchPromise = null;
  let mainFetchSeq = 0;
  async function loadFullSiteData() {
    if (activeFetchPromise) return activeFetchPromise;
    const currentSeq = ++mainFetchSeq;

    activeFetchPromise = (async () => {
      try {
        const res = await fetch('/api/site-data?t=' + Date.now(), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (!res.ok) throw new Error(`API HTTP Error: ${res.status}`);
        const data = await res.json();
        if (currentSeq < mainFetchSeq) {
          console.log(`⚠️ Discarding stale main fetch #${currentSeq} (latest is #${mainFetchSeq})`);
          return;
        }

        console.log('📡 [LIVE API DATA RECEIVED]:', {
          status: res.status,
          games_count: (data.games || []).length,
          game_ids: (data.games || []).map(g => g.id),
          hero_count: (data.hero_games || []).length,
          disawer_setting: data.settings ? data.settings.disawer_time : null
        });

        // Render fresh live API data immediately
        renderSiteData(data);
      } catch(err) {
        console.warn('⚠️ API fetch failed:', err);
      } finally {
        activeFetchPromise = null;
      }
    })();

    return activeFetchPromise;
  }

  window.latestSiteData = null;

  function getDeterministicResultGlobal(gameName, year, month, day) {
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return '-';
    
    const gUpper = String(gameName || '').trim().toUpperCase();
    let str = `${gUpper}|${year}|${month}|${day}|a77satta`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;

    const rand = (h >>> 0) % 100;
    return String(rand).padStart(2, '0');
  }

  function buildTableMarkupGlobal(name, chartRecords, year) {
    const cleanName = name
      .replace('SATTA KING CHART 2026', '')
      .replace('SATTA KING CHART 2025', '')
      .replace('SATTA KING CHART 2024', '')
      .replace('SATTA KING CHART', '')
      .replace('CHART 2026', '')
      .replace('CHART 2025', '')
      .replace('CHART 2024', '')
      .replace('CHART', '')
      .trim();

    const nowKolkata = new Date();
    const kFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = kFormatter.formatToParts(nowKolkata);
    const currKYear = parseInt(parts.find(p => p.type === 'year').value, 10);
    const currKMonth = parseInt(parts.find(p => p.type === 'month').value, 10);
    const currKDay = parseInt(parts.find(p => p.type === 'day').value, 10);

    const yestDateObj = new Date(Date.UTC(currKYear, currKMonth - 1, currKDay - 1));
    const yestParts = kFormatter.formatToParts(yestDateObj);
    const yestKMonth = parseInt(yestParts.find(p => p.type === 'month').value, 10);
    const yestKDay = parseInt(yestParts.find(p => p.type === 'day').value, 10);

    const targetYear = parseInt(year, 10) || 2026;
    const cUpper = cleanName.trim().toUpperCase();

    const fullDateMap = {};
    if (chartRecords && Array.isArray(chartRecords)) {
      chartRecords.forEach(r => {
        if (!r || !r.record_date || !r.game_name) return;
        const gUpper = r.game_name.trim().toUpperCase();
        const isGameMatch = (gUpper === cUpper) ||
          (cUpper === 'DISAWAR' && gUpper.startsWith('DISAW')) ||
          (gUpper === 'DISAWAR' && cUpper.startsWith('DISAW'));
        if (isGameMatch) {
          const rawDate = r.record_date.trim();
          let rDay = null;
          let rMonth = null;
          let rYear = null;

          if (rawDate.includes('-')) {
            const parts = rawDate.split('-');
            if (parts.length === 2) {
              rDay = parseInt(parts[0], 10);
              rMonth = parseInt(parts[1], 10);
              rYear = 2026;
            } else if (parts.length === 3) {
              if (parts[0].length === 4) {
                rYear = parseInt(parts[0], 10);
                rMonth = parseInt(parts[1], 10);
                rDay = parseInt(parts[2], 10);
              } else {
                rDay = parseInt(parts[0], 10);
                rMonth = parseInt(parts[1], 10);
                rYear = parseInt(parts[2], 10);
              }
            }
          }

          if (rDay && rMonth && rYear === targetYear) {
            fullDateMap[`${rMonth}_${rDay}`] = r.result_val !== undefined && r.result_val !== null ? String(r.result_val).trim() : '-';
          }
        }
      });
    }

    const tableRows = [];
    for (let day = 1; day <= 31; day++) {
      const row = [];
      for (let month = 1; month <= 12; month++) {
        const daysInMonth = new Date(targetYear, month, 0).getDate();
        if (day > daysInMonth) {
          row.push('-');
          continue;
        }

        const key = `${month}_${day}`;
        const dbVal = fullDateMap[key];

        if (targetYear === 2026) {
          if (month <= 7) {
            row.push((dbVal && dbVal !== '-' && dbVal !== 'WAIT') ? dbVal : getDeterministicResultGlobal(cleanName, 2026, month, day));
          } else if (month === 8) {
            row.push((dbVal && dbVal !== '') ? dbVal : getDeterministicResultGlobal(cleanName, 2026, 8, day));
          } else if (month === 9) {
            // Sep 2026: Strictly admin data only (no random numbers)
            const gObj = ((window.latestSiteData && window.latestSiteData.games) || []).find(x => {
              const n = (x.name || '').trim().toUpperCase();
              return n === cUpper || (cUpper === 'DISAWAR' && n.startsWith('DISAW')) || (n === 'DISAWAR' && cUpper.startsWith('DISAW'));
            });

            if (dbVal !== undefined && dbVal !== null && dbVal.trim() !== '' && dbVal.trim() !== '-' && dbVal.trim().toUpperCase() !== 'WAIT') {
              row.push(dbVal.trim());
            } else if (day === currKDay && month === currKMonth) {
              if (gObj && gObj.today_result && gObj.today_result.toUpperCase() !== 'WAIT' && gObj.today_result !== '-') {
                row.push(gObj.today_result.trim());
              } else {
                row.push('WAIT');
              }
            } else {
              row.push('-');
            }
          } else {
            row.push('-');
          }
        } else if (targetYear === 2025) {
          row.push((dbVal && dbVal !== '-' && dbVal !== 'WAIT') ? dbVal : getDeterministicResultGlobal(cleanName, 2025, month, day));
        } else {
          row.push((dbVal && dbVal !== '-' && dbVal !== 'WAIT') ? dbVal : getDeterministicResultGlobal(cleanName, targetYear, month, day));
        }
      }
      tableRows.push(row);
    }

    return `
      <div class="yearly-chart-modal-banner">
        ${cleanName} YEARLY CHART ${targetYear}
      </div>
      <div class="table-scroll-wrapper">
        <table class="satta-yearly-chart-table">
          <thead>
            <tr>
              <th>${targetYear}</th>
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

  window.openChartForGameName = async function(gameName, year) {
    if (!gameName) return;
    await loadFullSiteData();
    const cleanName = gameName.trim().toUpperCase();
    const selectedYear = year || '2026';
    const fullName = `${cleanName} SATTA KING CHART ${selectedYear}`;
    const modal = document.getElementById('chartModalOverlay');
    const modalTitle = document.getElementById('modalChartTitle');
    const modalBody = document.getElementById('chartModalBody');

    if (modal && modalBody) {
      if (modalTitle) modalTitle.textContent = fullName;
      const records = (window.latestSiteData && window.latestSiteData.chart_records) ? window.latestSiteData.chart_records : [];
      modalBody.innerHTML = buildTableMarkupGlobal(cleanName, records, selectedYear);
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    } else {
      window.location.href = '/chart?game=' + encodeURIComponent(cleanName) + '&year=' + encodeURIComponent(selectedYear);
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
    const chartRecords = (data && data.chart_records && Array.isArray(data.chart_records)) ? data.chart_records : [];
    try {
      // Calculate Asia/Kolkata dates
      const nowDate = new Date();
      const kolkataFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const todayFull = kolkataFormatter.format(nowDate);
      const [tY, tM, tD] = todayFull.split('-');
      const todayStr = `${tD}-${tM}`;

      const kolkataNowParts = kolkataFormatter.formatToParts(nowDate);
      let kYear = parseInt(kolkataNowParts.find(p => p.type === 'year').value, 10);
      let kMonth = parseInt(kolkataNowParts.find(p => p.type === 'month').value, 10) - 1;
      let kDay = parseInt(kolkataNowParts.find(p => p.type === 'day').value, 10);
      const kDateObj = new Date(Date.UTC(kYear, kMonth, kDay - 1));
      const yestFull = kolkataFormatter.format(kDateObj);
      const [yY, yM, yD] = yestFull.split('-');
      const yestStr = `${yD}-${yM}`;

      function getResultFromChartRecords(records, dateStr, gameName) {
        if (!records || !records.length || !dateStr || !gameName) return null;
        const gUpper = gameName.trim().toUpperCase();
        const rec = records.find(r => {
          if (!r.record_date || !r.game_name) return false;
          const rDate = r.record_date.trim();
          const rGame = r.game_name.trim().toUpperCase();
          return rDate === dateStr && (rGame === gUpper || (gUpper === 'DISAWAR' && rGame === 'DISAWER') || (gUpper === 'DISAWER' && rGame === 'DISAWAR'));
        });
        return rec ? rec.result_val : null;
      }

      // Populate Search Filter Dropdown (#gameSelect) with Table 1 Games
      const gameSelectEl = document.getElementById('gameSelect');
      if (gameSelectEl) {
        if (data.games && data.games.length > 0) {
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
        } else {
          gameSelectEl.innerHTML = '<option value="">No Games Available</option>';
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
        
        // Marquee ticker (all pages)
        const marquees = document.querySelectorAll('.sub-nav-ticker marquee, marquee');
        if (s.ticker_text) {
          marquees.forEach(m => {
            m.textContent = s.ticker_text;
          });
        }

        // Hindi tagline
        const taglines = document.querySelectorAll('.result-text, .hindi-tagline');
        if (s.hindi_tagline) {
          taglines.forEach(t => {
            t.textContent = s.hindi_tagline;
          });
        }

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

        // Render Dynamic Notice Banners (Strictly from Database)
        const noticeWrap = document.getElementById('noticeBannersContainer');
        if (noticeWrap) {
          let noticeList = [];
          if (s.notice_banners_json !== undefined && s.notice_banners_json !== null) {
            try {
              const parsed = JSON.parse(s.notice_banners_json);
              if (Array.isArray(parsed)) noticeList = parsed;
            } catch(e) {}
          } else if (s.notice_1 || s.notice_2) {
            if (s.notice_1) noticeList.push({ id: 1, text: s.notice_1 });
            if (s.notice_2) noticeList.push({ id: 2, text: s.notice_2 });
          }

          if (noticeList.length === 0) {
            noticeWrap.innerHTML = '';
            noticeWrap.style.display = 'none';
          } else {
            noticeWrap.style.display = '';
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
        }

        // Render Dynamic Khaiwal Cards Grid (Strictly from Database)
        const khaiwalGrid = document.getElementById('khaiwalGridContainer');
        if (khaiwalGrid) {
          let cardList = [];
          if (s.khaiwal_cards_json !== undefined && s.khaiwal_cards_json !== null) {
            try {
              const parsed = typeof s.khaiwal_cards_json === 'string' ? JSON.parse(s.khaiwal_cards_json) : s.khaiwal_cards_json;
              if (Array.isArray(parsed)) cardList = parsed;
            } catch(e) {}
          }

          if (!cardList || !Array.isArray(cardList) || cardList.length === 0) {
            khaiwalGrid.innerHTML = '';
            khaiwalGrid.style.display = 'none';
          } else {
            khaiwalGrid.style.display = '';
            let gridHtml = '';
          cardList.forEach(c => {
            const waUrl = c.whatsapp_url || s.whatsapp_url || '#';
            const bodyLines = (c.times_text || '').split('\n').map(line => line.trim()).filter(Boolean).join('<br>\n            ');
            if (c.card_type === 'feature') {
              gridHtml += `
        <article class="schedule-panel feature-card">
          <header class="schedule-header">
            ${c.header_subtitle ? `<div class="subtitle-text">${c.header_subtitle}</div>` : ''}
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
            <div class="subtitle-text">${c.header_subtitle || '--सीधी सट्टा कंपनी का No 1 खाईवाल--'}</div>
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
            }
          });
          khaiwalGrid.innerHTML = gridHtml;
        }
      }
    }

      // Render Main Hero Box Games (Dynamic Stack from Table 1)
      const heroContainer = document.getElementById('heroGamesList');
      if (heroContainer) {
        let heroList = (data.hero_games && data.hero_games.length > 0)
          ? data.hero_games
          : (data.games || []).filter(g => parseInt(g.is_hero) === 1);

        if (heroList.length > 0) {
          heroContainer.style.display = 'flex';
          let heroHtml = '';
          heroList.forEach(g => {
            const name = g.name ? g.name.trim().toUpperCase() : 'GAME';
            const chartTodayVal = getResultFromChartRecords(chartRecords, todayStr, name);
            
            let resVal = 'WAIT';
            if (g.today_result && g.today_result.trim() !== '' && g.today_result.trim().toUpperCase() !== 'WAIT' && g.today_result.trim() !== '-') {
              resVal = g.today_result.trim();
            } else if (chartTodayVal !== null && chartTodayVal !== undefined && chartTodayVal !== '' && chartTodayVal !== '-' && chartTodayVal.toUpperCase() !== 'WAIT') {
              resVal = chartTodayVal.trim();
            }

            const resHtml = (!resVal || resVal.toUpperCase() === 'WAIT')
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
        } else {
          heroContainer.innerHTML = '';
          heroContainer.style.display = 'none';
        }
      }

      // Render Permanent DISAWAR Feature Box (Dynamic from DB Games & Date Records)
      const bannerBox = document.getElementById('featuredBannerBox') || document.querySelector('.bottom-disclaimer');
      if (bannerBox) {
        bannerBox.style.display = 'flex';
        const actualGameName = 'DISAWAR';
        const s = data.settings || {};
        const disawerGame = (data.games || []).find(g => (g.name || '').trim().toUpperCase().startsWith('DISAW'));

        const bannerTime = (disawerGame && disawerGame.open_time && disawerGame.open_time.trim())
          ? disawerGame.open_time.trim()
          : (s.disawer_time ? s.disawer_time.trim() : '05:15 AM');

        let finalYest = (getResultFromChartRecords(chartRecords, yestStr, actualGameName) || (disawerGame && disawerGame.yesterday_result && disawerGame.yesterday_result !== '-' ? disawerGame.yesterday_result.trim() : '-'));

        let finalToday = 'WAIT';
        if (disawerGame && disawerGame.today_result && disawerGame.today_result.trim() !== '' && disawerGame.today_result.trim().toUpperCase() !== 'WAIT' && disawerGame.today_result.trim() !== '-') {
          finalToday = disawerGame.today_result.trim();
        } else {
          const chartVal = getResultFromChartRecords(chartRecords, todayStr, actualGameName);
          finalToday = (chartVal && chartVal.toUpperCase() !== 'WAIT' && chartVal !== '-') ? chartVal : 'WAIT';
        }

        console.log('📌 [DISAWAR BANNER RENDERED]:', {
          time: bannerTime,
          yesterday: finalYest,
          today: finalToday
        });

        const todayHtml = (!finalToday || finalToday.toUpperCase() === 'WAIT')
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
      if (board1) {
        const games = (data && Array.isArray(data.games)) ? data.games : [];
        const group1 = games.filter(g => parseInt(g.table_group) === 1 || !g.table_group);
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

            const yestRes = (chartYestVal !== null && chartYestVal !== undefined && chartYestVal !== '' && chartYestVal !== '-')
              ? chartYestVal
              : ((g.yesterday_result && g.yesterday_result !== '-' && g.yesterday_result.trim()) ? g.yesterday_result.trim() : '-');

            let todayRaw = 'WAIT';
            if (g.today_result && g.today_result.trim() !== '' && g.today_result.trim().toUpperCase() !== 'WAIT' && g.today_result.trim() !== '-') {
              todayRaw = g.today_result.trim();
            } else if (chartTodayVal !== null && chartTodayVal !== undefined && chartTodayVal !== '' && chartTodayVal !== '-' && chartTodayVal.toUpperCase() !== 'WAIT') {
              todayRaw = chartTodayVal.trim();
            }

            const todayResHtml = (!todayRaw || todayRaw.toUpperCase() === 'WAIT')
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
        } else {
          board1.innerHTML = `
            <div class="a77-market-board-header">
              <div>सट्टा का नाम</div>
              <div>कल आया था</div>
              <div>आज का रिजल्ट</div>
            </div>
            <div class="a77-market-row" style="justify-content: center; padding: 20px; font-weight: 700; color: #ffd700;">
              <div style="text-align: center; width: 100%;">NO GAMES CREATED YET. ADD GAMES FROM ADMIN PANEL.</div>
            </div>
          `;
        }
      }

      // Dynamic Month Name Header
      const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      const nowMonthIdx = new Date().getMonth();
      const nowYear = new Date().getFullYear();
      const chartHeaderEl = document.querySelector('.chart-main-header');
      if (chartHeaderEl) {
        chartHeaderEl.textContent = `SATTA RESULT CHART ${monthNames[nowMonthIdx]} ${nowYear}`;
      }

      // 3. Record Chart Tables Sync
      const recordsMap = {};
      const recordMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
      const datesSet = new Set(getAutoDatesUpToToday());
      
      if (data.chart_records && Array.isArray(data.chart_records)) {
        data.chart_records.forEach(r => {
          if (r.record_date && r.game_name) {
            const key = `${r.record_date.trim()}_${r.game_name.trim().toUpperCase()}`;
            recordsMap[key] = r.result_val;
            const parts = r.record_date.trim().split('-');
            if (parts.length === 2 && parts[1] === recordMonthStr) {
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
          const gObj = (data.games || []).find(x => {
            const n = (x.name || '').trim().toUpperCase();
            return n === gUpper || (gUpper === 'DISAWAR' && n.startsWith('DISAW')) || (n === 'DISAWAR' && gUpper.startsWith('DISAW'));
          });

          let val = recordsMap[directKey];
          if (val === undefined || val === '' || val === null) {
            for (const [k, v] of Object.entries(recordsMap)) {
              const [d, g] = k.split('_');
              if (d === date) {
                if (g === gUpper || (gUpper === 'DISAWAR' && g.startsWith('DISAW')) || (g === 'DISAWAR' && gUpper.startsWith('DISAW'))) {
                  val = v;
                  break;
                }
              }
            }
          }

          // 1. If valid result entered in chart_records
          if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim().toUpperCase() !== 'WAIT') {
            return String(val).trim();
          }

          // 2. Direct check for today result
          if (date === todayStr && gObj && gObj.today_result && gObj.today_result.toUpperCase() !== 'WAIT' && gObj.today_result !== '-') {
            return gObj.today_result.trim();
          }

          if (val === '-') return '-';

          // 3. If today is still WAIT
          if (date === todayStr && gObj && (!gObj.today_result || gObj.today_result.toUpperCase() === 'WAIT')) {
            return '<span class="market-wait" style="font-size:11px;">WAIT</span>';
          }

          return '-';
        }

        const tableWraps = document.querySelectorAll('.lower-stat-table-wrap');

        // Table 1 (Main Games)
        if (tableWraps.length > 0) {
          const mainGames = (data.games && Array.isArray(data.games))
            ? data.games.map(g => (g.name || '').trim().toUpperCase()).filter(Boolean)
            : [];
          const t1Thead = tableWraps[0].querySelector('thead');
          const t1Tbody = tableWraps[0].querySelector('tbody');

          if (mainGames.length === 0) {
            if (t1Thead) t1Thead.innerHTML = `<tr><th>Date</th><th>Status</th></tr>`;
            if (t1Tbody) {
              t1Tbody.innerHTML = `
                <tr>
                  <td colspan="2" style="text-align:center; padding: 25px; font-weight:700; color: #ffd700;">
                    NO GAMES AVAILABLE IN TABLE 1. ADD GAMES FROM ADMIN PANEL.
                  </td>
                </tr>
              `;
            }
          } else {
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

  // Revalidation Listeners: Window Focus & Tab Visibility
  window.addEventListener('focus', loadFullSiteData);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadFullSiteData();
    }
  });

  // 15-Second Polling Interval
  setInterval(loadFullSiteData, 15000);

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

  // Trigger load on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initRefreshBtn();
      loadFullSiteData();
    });
  } else {
    initRefreshBtn();
    loadFullSiteData();
  }

})();
