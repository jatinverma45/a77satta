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
  async function loadFullSiteData() {
    try {
      const res = await fetch('/api/site-data?t=' + Date.now(), { cache: 'no-store' });
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
          if (!cardList || cardList.length === 0) {
            cardList = [
              {
                header_subtitle: "--सीधी सट्टा कंपनी का No 1 शर्तावाल--",
                title: "♣ KUBER BHAI KHAIWAL ♣",
                card_type: "standard",
                times_text: "सट्टे बाजार ----------- 1:30 pm\nघाटियाल ----------- 2:30 pm\nदिल्ली बाजार ----------- 2:50 pm\nदिल्ली मटका ----------- 3:20 PM\nश्री गणेश ----------- 4:20 pm\nआगारा ----------- 5:20 pm\nफरीदाबाद ----------- 5:50 pm\nअलवर ----------- 7:20 pm\nगाजियाबाद ----------- 8:50 pm\nझारखा ----------- 10:10 pm\nगली ----------- 11:20 pm\nडिसावर ----------- 1:30 AM",
                footer_text: "Game play करने के लिए नीचे लिंक पर क्लिक करें",
                whatsapp_url: s.whatsapp_url || "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e"
              },
              {
                header_subtitle: "--सीधी सट्टा कम्पनी का No 1 शर्तावाल--",
                title: "♣ JASSI BHAI KHAIWAL ♣",
                card_type: "standard",
                times_text: "सट्टे बाजार ----------- 1:30 pm\nघाटियाल ----------- 2:30 pm\nदिल्ली बाजार ----------- 2:50 pm\nदिल्ली मटका ----------- 3:20 PM\nश्री गणेश ----------- 4:20 pm\nआगारा ----------- 5:20 pm\nफरीदाबाद ----------- 5:50 pm\nअलवर ----------- 7:20 pm\nगाजियाबाद ----------- 8:50 pm\nझारखा ----------- 10:10 pm\nगली ----------- 11:20 pm\nडिसावर ----------- 1:30 AM",
                footer_text: "Game play करने के लिए नीचे लिंक पर क्लिक करें",
                whatsapp_url: s.whatsapp_url || "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e"
              },
              {
                header_subtitle: "",
                title: "नमस्कार सपयानी Cricket ID दोनों वाले भाई नीचे दिए गए लिंक पर क्लिक करें",
                card_type: "feature",
                times_text: "minimum ID 500₹ maximum no limit\n*** *** *** *** *** *** *** ***\nNote इस नंबर पर पैसे क्लिक करने वाले जो भी गलत होगा फिर\nफॉल्ट के लिए payment के लिए money transfer की जगह अन्य जगह हो सकता है",
                footer_text: "",
                whatsapp_url: s.whatsapp_url || "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e"
              },
              {
                header_subtitle: "--सीधी सट्टा कंपनी का No 1 शर्तावाल--",
                title: "♣ RAMAN BHAI KHAIWAL ♣",
                card_type: "standard",
                times_text: "सट्टे बाजार ----------- 1:30 pm\nघाटियाल ----------- 2:30 pm\nदिल्ली बाजार ----------- 2:50 pm\nदिल्ली मटका ----------- 3:20 PM\nश्री गणेश ----------- 4:20 pm\nआगारा ----------- 5:20 pm\nफरीदाबाद ----------- 5:50 pm\nअलवर ----------- 7:20 pm\nगाजियाबाद ----------- 8:50 pm\nझारखा ----------- 10:10 pm\nगली ----------- 11:20 pm\nडिसावर ----------- 1:30 AM",
                footer_text: "Game play करने के लिए नीचे लिंक पर क्लिक करें",
                whatsapp_url: s.whatsapp_url || "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e"
              }
            ];
          }

          let gridHtml = '';
          cardList.forEach(c => {
            const waUrl = c.whatsapp_url || s.whatsapp_url || '#';
            if (c.card_type === 'feature') {
              const rowsHtml = (c.times_text || '').split('\n').map(line => `<div class="mini-row">${line}</div>`).join('');
              gridHtml += `
                <article class="schedule-panel schedule-panel-feature">
                  <div class="mid-text">${c.title || ''}</div>
                  <div class="mini-game-status">
                    ${rowsHtml}
                  </div>
                  <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="whatsapp-cta-small whatsapp-cta-feature">
                    <span class="whatsapp-cta-icon">☎</span>
                    <span class="whatsapp-cta-copy">WhatsApp<br><small>Click to chat</small></span>
                  </a>
                </article>
              `;
            } else {
              const timesLines = (c.times_text || '').split('\n').map(line => {
                if (!line.trim()) return '';
                if (line.includes('-----------')) {
                  const parts = line.split('-----------');
                  return `<div><span class="schedule-dot">○</span> ${parts[0].trim()} ----------- ${parts[1].trim()}</div>`;
                }
                return `<div><span class="schedule-dot">○</span> ${line.trim()}</div>`;
              }).join('');

              gridHtml += `
                <article class="schedule-panel">
                  <div class="schedule-title">${c.header_subtitle || '--सीधी सट्टा कंपनी का No 1 शर्तावाल--'}<br><span>${c.title || ''}</span></div>
                  <div class="schedule-times">
                    ${timesLines}
                  </div>
                  <div class="schedule-footer">${c.footer_text || 'Game play करने के लिए नीचे लिंक पर क्लिक करें'}</div>
                  <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="whatsapp-cta-small">
                    <span class="whatsapp-cta-icon">☎</span>
                    <span class="whatsapp-cta-copy">WhatsApp<br><small>Click to chat</small></span>
                  </a>
                </article>
              `;
            }
          });
          khaiwalGrid.innerHTML = gridHtml;
        }
      }

      // Render Main Hero Box Games (Dynamic Stack)
      const heroContainer = document.getElementById('heroGamesList');
      if (heroContainer) {
        let heroList = data.hero_games;
        if ((!heroList || heroList.length === 0) && data.settings && data.settings.hero_games_json) {
          try { heroList = JSON.parse(data.settings.hero_games_json); } catch(e) {}
        }
        if (!heroList || heroList.length === 0) {
          heroList = [
            { name: 'RAJ SHREE', today_result: 'WAIT' },
            { name: 'UDAIPUR CITY', today_result: 'WAIT' }
          ];
        }

        let heroHtml = '';
        heroList.forEach(g => {
          const name = g.name ? g.name.trim().toUpperCase() : 'GAME';
          const resVal = g.today_result ? g.today_result.trim() : (g.result || 'WAIT');
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
      if (data.chart_records) {
        const recordsMap = {};
        const datesSet = new Set(getAutoDatesUpToToday());
        
        data.chart_records.forEach(r => {
          if (r.record_date && r.game_name) {
            const key = `${r.record_date.trim()}_${r.game_name.trim().toUpperCase()}`;
            recordsMap[key] = r.result_val;
            datesSet.add(r.record_date.trim());
          }
        });

        const dates = Array.from(datesSet).sort();

        function getVal(date, gameName) {
          const gUpper = gameName.trim().toUpperCase();
          const directKey = `${date}_${gUpper}`;
          if (recordsMap[directKey] !== undefined) return recordsMap[directKey];

          // Fuzzy search fallback for capitalization or variant names
          for (const [k, v] of Object.entries(recordsMap)) {
            const [d, g] = k.split('_');
            if (d === date) {
              if (g.includes(gUpper) || gUpper.includes(g) || (gUpper === 'DISAWER' && g === 'DESAWAR') || (gUpper === 'DESAWAR' && g === 'DISAWER')) {
                return v;
              }
            }
          }
          return '-';
        }

        const tableWraps = document.querySelectorAll('.lower-stat-table-wrap');

        // Table 1 (Main 12 Games)
        if (tableWraps.length > 0) {
          const mainGames = ['SADAR BAZAR', 'GWALIOR', 'DELHI BAZAR', 'DELHI MATKA', 'SHRI GANESH', 'AGRA', 'FARIDABAD', 'ALWAR', 'GAZIABAD', 'DWARKA', 'GALI', 'DISAWER'];
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

        // Table 2 (20 Lower Games)
        if (tableWraps.length > 1) {
          const lowerGames = [
            'HR SATTA', 'UJJALA SUPER', 'KKR CITY', 'MADHUPURI', 'ANMOL BAZAR', 'KAROL BAGH',
            'AMMAN BAZAR', 'DELHI DARBAR', 'NEW GANGA', 'SKY KING', 'FATEHABAD', 'UDAIPUR CITY', 'RAJ SHREE',
            'VIP AGRA', 'MOHALI-7', 'BHADRA BAZAR', 'MANDI BAZAR', 'LION BAZAR', 'SIALKOT',
            'DEHRADUN CITY', 'DAMAN'
          ];
          const t2Thead = tableWraps[1].querySelector('thead');
          const t2Tbody = tableWraps[1].querySelector('tbody');

          if (t2Thead) {
            t2Thead.innerHTML = `<tr><th>Date</th>${lowerGames.map(g => `<th>${g}</th>`).join('')}</tr>`;
          }

          if (t2Tbody) {
            let html = '';
            dates.forEach(d => {
              html += `<tr><td>${d}</td>`;
              lowerGames.forEach(g => {
                html += `<td>${getVal(d, g)}</td>`;
              });
              html += `</tr>`;
            });
            t2Tbody.innerHTML = html;
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
