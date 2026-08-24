const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { Pool: PgPool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname)));

const SUPABASE_DB_URI = process.env.SUPABASE_DB_URI || 'postgresql://postgres.sszqmfagodieabgsbzev:SattaaA77king@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const pgPool = new PgPool({
  connectionString: SUPABASE_DB_URI,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000
});

function safeQuery(text, params = []) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error('PostgreSQL query timeout (10s limit)'));
      }
    }, 10000);

    pgPool.query(text, params)
      .then(res => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch(err => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

// Setup SQLite fallback instance for local or offline use
let dbPath = path.join(__dirname, 'a77satta.db');
if (process.env.VERCEL) {
  dbPath = '/tmp/a77satta.db';
}
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('SQLite connection error:', err);
});

// Backup Sync Engine
const bundledBackupPath = path.join(__dirname, 'data_backup.json');
const tmpBackupPath = process.env.VERCEL ? '/tmp/data_backup.json' : bundledBackupPath;

async function syncJSONBackup() {
  try {
    const [settingsRes, gamesRes, chartsRes, blogsRes] = await Promise.all([
      safeQuery('SELECT key, value FROM site_settings').catch(() => null),
      safeQuery('SELECT * FROM games ORDER BY sort_order ASC, id ASC').catch(() => null),
      safeQuery('SELECT * FROM chart_records ORDER BY record_date ASC').catch(() => null),
      safeQuery('SELECT * FROM blogs ORDER BY id DESC').catch(() => null)
    ]);

    // ABSOLUTE RULE: Never update memory cache or disk file if PostgreSQL query failed
    if (!gamesRes || !gamesRes.rows) {
      console.warn('⚠️ syncJSONBackup: PostgreSQL query failed, aborting backup sync.');
      return false;
    }

    const fullData = {
      settings: (memoryBackupCache && memoryBackupCache.settings) ? memoryBackupCache.settings : {},
      games: gamesRes.rows.filter(g => g && g.name),
      chart_records: (chartsRes && chartsRes.rows) ? chartsRes.rows : [],
      blogs: (blogsRes && blogsRes.rows) ? blogsRes.rows : []
    };

    if (settingsRes && settingsRes.rows) {
      settingsRes.rows.forEach(s => {
        fullData.settings[s.key] = s.value;
      });
    }

    memoryBackupCache = fullData;

    try {
      const jsonStr = JSON.stringify(fullData, null, 2);
      fs.writeFileSync(tmpBackupPath, jsonStr);
      if (tmpBackupPath !== bundledBackupPath) {
        try { fs.writeFileSync(bundledBackupPath, jsonStr); } catch (e) {}
      }
    } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

function saveBackupDataLocally(updatedData) {
  memoryBackupCache = updatedData;
  try {
    const jsonStr = JSON.stringify(updatedData, null, 2);
    fs.writeFileSync(tmpBackupPath, jsonStr);
    if (tmpBackupPath !== bundledBackupPath) {
      try { fs.writeFileSync(bundledBackupPath, jsonStr); } catch (e) {}
    }
  } catch(e) {}
}

// Database Initialization Middleware
let isDbReady = false;
async function initDatabase() {
  if (isDbReady) return;
  try {
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        open_time VARCHAR(50),
        close_time VARCHAR(50),
        yesterday_result VARCHAR(50) DEFAULT '-',
        today_result VARCHAR(50) DEFAULT 'WAIT',
        table_group INT DEFAULT 1,
        sort_order INT DEFAULT 0,
        is_hero INT DEFAULT 0,
        is_featured INT DEFAULT 0,
        is_permanent INT DEFAULT 0
      );
      ALTER TABLE games ADD COLUMN IF NOT EXISTS is_permanent INT DEFAULT 0;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS is_featured INT DEFAULT 0;

      CREATE TABLE IF NOT EXISTS chart_records (
        id SERIAL PRIMARY KEY,
        record_date VARCHAR(50) NOT NULL,
        game_name VARCHAR(100) NOT NULL,
        result_val VARCHAR(50) DEFAULT '-',
        UNIQUE(record_date, game_name)
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS blogs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        image TEXT,
        post_date VARCHAR(100),
        tags TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure Admin User Exists
    const adminRes = await pgPool.query('SELECT COUNT(*) as count FROM admin');
    if (parseInt(adminRes.rows[0].count) === 0) {
      const adminPassword = bcrypt.hashSync('SattaA77@77', 10);
      await pgPool.query('INSERT INTO admin (username, password) VALUES ($1, $2)', ['A77SattaOfficial', adminPassword]);
      console.log('🔑 Admin credentials initialized in Supabase PostgreSQL');
    }

    console.log('🚀 Supabase Real SQL PostgreSQL Database Initialized Successfully!');
    try {
      const backup = getBackupData();
      if (backup && backup.settings) {
        for (const [key, value] of Object.entries(backup.settings)) {
          const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          await pgPool.query('INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, valStr]).catch(()=>{});
        }
      }

      // ONLY seed backup.games IF PostgreSQL games table is COMPLETELY EMPTY
      const existingGamesCountRes = await pgPool.query('SELECT COUNT(*) as count FROM games').catch(() => ({ rows: [{ count: 0 }] }));
      const gamesCount = parseInt(existingGamesCountRes.rows[0].count, 10) || 0;

      if (gamesCount === 0 && backup && Array.isArray(backup.games)) {
        console.log('🌱 Seeding games table from initial backup data (database was empty)...');
        for (const g of backup.games) {
          if (g && g.name) {
            const gName = g.name.trim().toUpperCase() === 'DISAWER' ? 'DISAWAR' : g.name.trim().toUpperCase();
            const isPerm = gName === 'DISAWAR' ? 1 : (g.is_permanent ? 1 : 0);
            await pgPool.query(
              `INSERT INTO games (name, open_time, close_time, yesterday_result, today_result, table_group, sort_order, is_hero, is_featured, is_permanent)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (name) DO NOTHING`,
              [
                gName,
                g.open_time || '',
                g.close_time || '',
                g.yesterday_result || '-',
                g.today_result || 'WAIT',
                parseInt(g.table_group) || 1,
                parseInt(g.sort_order) || 0,
                g.is_hero ? 1 : 0,
                g.is_featured ? 1 : 0,
                isPerm
              ]
            ).catch(()=>{});
          }
        }
      }

      // Purge legacy deleted game GANDU if present
      await safeQuery(`DELETE FROM games WHERE UPPER(name) = 'GANDU'`).catch(()=>{});

      // Normalize DISAWER -> DISAWAR in games and chart_records
      await safeQuery(`UPDATE games SET name = 'DISAWAR', is_permanent = 1 WHERE UPPER(name) = 'DISAWER'`).catch(()=>{});
      await safeQuery(`UPDATE chart_records SET game_name = 'DISAWAR' WHERE UPPER(game_name) = 'DISAWER'`).catch(()=>{});

      // Ensure permanent single canonical DISAWAR system game exists in Table 1
      await safeQuery(
        `INSERT INTO games (name, open_time, yesterday_result, today_result, table_group, sort_order, is_hero, is_featured, is_permanent)
         VALUES ('DISAWAR', '05:15 AM', '-', 'WAIT', 1, 0, 0, 1, 1)
         ON CONFLICT (name) DO UPDATE SET is_permanent = 1, table_group = 1`
      ).catch(() => {});

      syncJSONBackup().catch(() => {});
    } catch(e) {}
    isDbReady = true;
  } catch (e) {
    console.error('❌ Supabase PostgreSQL initialization error:', e.message);
    isDbReady = true;
  }
}

const dbReadyPromise = initDatabase();

app.use(async (req, res, next) => {
  if (!isDbReady) {
    await dbReadyPromise;
  }
  next();
});

// ========================================
// REST API ROUTES (DIRECT POSTGRESQL DRIVEN)
// ========================================

let memoryBackupCache = null;

function getBackupData() {
  if (memoryBackupCache) return memoryBackupCache;

  const bPath = process.env.VERCEL ? '/tmp/data_backup.json' : path.join(__dirname, 'data_backup.json');
  if (fs.existsSync(bPath)) {
    try {
      memoryBackupCache = JSON.parse(fs.readFileSync(bPath, 'utf8'));
      return memoryBackupCache;
    } catch (e) {}
  }
  const bundled = path.join(__dirname, 'data_backup.json');
  if (fs.existsSync(bundled)) {
    try {
      memoryBackupCache = JSON.parse(fs.readFileSync(bundled, 'utf8'));
      return memoryBackupCache;
    } catch (e) {}
  }
  return { settings: {}, games: [], chart_records: [], blogs: [] };
}

// Public: Get all site data for homepage & chart page
app.get('/api/site-data', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const [settingsRes, gamesRes, chartsRes, blogsRes] = await Promise.all([
      safeQuery('SELECT key, value FROM site_settings').catch(() => null),
      safeQuery('SELECT * FROM games ORDER BY sort_order ASC, id ASC').catch(() => null),
      safeQuery('SELECT * FROM chart_records ORDER BY record_date ASC').catch(() => null),
      safeQuery('SELECT * FROM blogs ORDER BY id DESC').catch(() => null)
    ]);

    let settings = {};
    if (settingsRes && settingsRes.rows) {
      settingsRes.rows.forEach(s => {
        if (s.key !== 'chart1_columns_json' && s.key !== 'chart2_columns_json') {
          settings[s.key] = s.value;
        }
      });
    }

    const backup = getBackupData();
    if (backup && backup.settings) {
      Object.keys(backup.settings).forEach(k => {
        if (settings[k] === undefined && k !== 'chart1_columns_json' && k !== 'chart2_columns_json') {
          settings[k] = backup.settings[k];
        }
      });
    }

    const DEFAULT_KHAIWAL_CARDS = [
      { id: 1, header_subtitle: "--सीधी सट्टा कंपनी का No 1 शर्तावाल--", title: "♣ KUBER BHAI KHAIWAL ♣", card_type: "standard", times_text: "सट्टे बाजार ----------- 1:30 pm\nघाटियाल ----------- 2:30 pm\nदिल्ली बाजार ----------- 2:50 pm\nदिल्ली मटका ----------- 3:20 PM\nश्री गणेश ----------- 4:20 pm\nआगारा ----------- 5:20 pm\nफरीदाबाद ----------- 5:50 pm\nअलवर ----------- 7:20 pm\nगाजियाबाद ----------- 8:50 pm\nझारखा ----------- 10:10 pm\nगली ----------- 11:20 pm\nडिसावर ----------- 1:30 AM", footer_text: "Game play करने के लिए नीचे लिंक पर क्लिक करें", whatsapp_url: "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e" },
      { id: 2, header_subtitle: "--सीधी सट्टा कम्पनी का No 1 शर्तावाल--", title: "♣ NEW BHAI KHAIWAL ♣", card_type: "standard", times_text: "सट्टे बाजार ----------- 1:30 pm\nघाटियाल ----------- 2:30 pm\nदिल्ली बाजार ----------- 2:50 pm\nदिल्ली मटका ----------- 3:20 PM\nश्री गणेश ----------- 4:20 pm\nआगारा ----------- 5:20 pm\nफरीदाबाद ----------- 5:50 pm\nअलवर ----------- 7:20 pm\nगाजियाबाद ----------- 8:50 pm\nझारखा ----------- 10:10 pm\nगली ----------- 11:20 pm\nडिसावर ----------- 1:30 AM", footer_text: "Game play करने के लिए नीचे लिंक पर क्लिक करें", whatsapp_url: "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e" }
    ];

    if (!settings.khaiwal_cards_json || settings.khaiwal_cards_json === "[]") {
      settings.khaiwal_cards_json = JSON.stringify(DEFAULT_KHAIWAL_CARDS);
    }

    let games = [];
    if (gamesRes && gamesRes.rows) {
      games = gamesRes.rows.filter(g => g && g.name);
    } else if (memoryBackupCache && Array.isArray(memoryBackupCache.games)) {
      games = memoryBackupCache.games.filter(g => g && g.name);
    }

    const uniqueGamesByName = {};
    games.forEach(g => {
      if (g && g.name) {
        let uName = g.name.trim().toUpperCase();
        if (uName === 'DISAWER') uName = 'DISAWAR';
        g.name = uName;
        if (uName === 'DISAWAR') g.is_permanent = 1;
        uniqueGamesByName[uName] = g;
      }
    });

    if (!uniqueGamesByName['DISAWAR']) {
      uniqueGamesByName['DISAWAR'] = {
        id: 99999,
        name: 'DISAWAR',
        open_time: '05:15 AM',
        yesterday_result: '-',
        today_result: 'WAIT',
        table_group: 1,
        sort_order: 0,
        is_hero: 0,
        is_featured: 1,
        is_permanent: 1
      };
    }

    games = Object.values(uniqueGamesByName);
    games.sort((a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0));

    // CANONICAL SINGLE SOURCE OF TRUTH FILTERING:
    const activeGameNames = new Set(games.map(g => (g.name || '').trim().toUpperCase()).filter(Boolean));

    const chartMap = {};
    (backup.chart_records || []).forEach(r => {
      if (r && r.record_date && r.game_name) {
        let gNameUpper = r.game_name.trim().toUpperCase();
        if (gNameUpper === 'DISAWER') gNameUpper = 'DISAWAR';
        if (activeGameNames.has(gNameUpper)) {
          chartMap[`${r.record_date.trim()}_${gNameUpper}`] = { ...r, game_name: gNameUpper };
        }
      }
    });
    if (chartsRes && chartsRes.rows && chartsRes.rows.length > 0) {
      chartsRes.rows.forEach(r => {
        if (r && r.record_date && r.game_name) {
          let gNameUpper = r.game_name.trim().toUpperCase();
          if (gNameUpper === 'DISAWER') gNameUpper = 'DISAWAR';
          if (activeGameNames.has(gNameUpper)) {
            chartMap[`${r.record_date.trim()}_${gNameUpper}`] = { ...r, game_name: gNameUpper };
          }
        }
      });
    }
    let charts = Object.values(chartMap);

    // Compute dynamic today_result and yesterday_result for games based on Asia/Kolkata dates
    const { todayStr, yestStr, todayFull, yestFull } = getTodayAndYesterdayDateStr();
    games.forEach(g => {
      const gName = (g.name || '').trim().toUpperCase();

      const yestRec = charts.find(r => {
        if (!r || !r.record_date || !r.game_name) return false;
        const rGame = r.game_name.trim().toUpperCase();
        const isGameMatch = rGame === gName || (gName === 'DISAWAR' && rGame === 'DISAWER');
        const rDate = r.record_date.trim();
        return isGameMatch && (rDate === yestFull || rDate === yestStr);
      });
      g.yesterday_result = (yestRec && yestRec.result_val && yestRec.result_val.trim() !== '') ? yestRec.result_val.trim() : '-';

      const todayRec = charts.find(r => {
        if (!r || !r.record_date || !r.game_name) return false;
        const rGame = r.game_name.trim().toUpperCase();
        const isGameMatch = rGame === gName || (gName === 'DISAWAR' && rGame === 'DISAWER');
        const rDate = r.record_date.trim();
        return isGameMatch && (rDate === todayFull || rDate === todayStr);
      });
      g.today_result = (todayRec && todayRec.result_val && todayRec.result_val.trim() !== '' && todayRec.result_val.toUpperCase() !== 'WAIT') ? todayRec.result_val.trim() : 'WAIT';
    });

    let heroGames = games.filter(g => parseInt(g.is_hero) === 1);
    if (heroGames.length === 0 && settings.hero_games_json) {
      try {
        const parsedHero = JSON.parse(settings.hero_games_json);
        if (Array.isArray(parsedHero) && parsedHero.length > 0) {
          const heroNames = new Set(parsedHero.map(h => (h.name || '').trim().toUpperCase()));
          heroGames = games.filter(g => heroNames.has((g.name || '').trim().toUpperCase()));
        }
      } catch(e) {}
    }

    if (games.length === 0) {
      charts = [];
      heroGames = [];
      settings.hero_games_json = "[]";
      settings.custom_chart_cards_json = "[]";
    } else if (settings.custom_chart_cards_json) {
      try {
        const parsedCards = JSON.parse(settings.custom_chart_cards_json);
        if (Array.isArray(parsedCards)) {
          const filteredCards = parsedCards.filter(cardTitle => {
            const uTitle = String(cardTitle || '').toUpperCase();
            return Array.from(activeGameNames).some(gName => uTitle.includes(gName));
          });
          settings.custom_chart_cards_json = JSON.stringify(filteredCards);
        }
      } catch(e) {}
    }

    return res.json({
      settings,
      games,
      hero_games: heroGames,
      chart_records: charts,
      blogs
    });
  } catch (e) {
    const backup = getBackupData();
    const bgames = backup.games || [];
    const bGameNames = new Set(bgames.map(g => (g.name || '').trim().toUpperCase()).filter(Boolean));
    const bCharts = (backup.chart_records || []).filter(r => r && r.game_name && bGameNames.has(r.game_name.trim().toUpperCase()));
    return res.json({
      settings: backup.settings || {},
      games: bgames,
      hero_games: bgames.filter(g => parseInt(g.is_hero) === 1),
      chart_records: bgames.length === 0 ? [] : bCharts,
      blogs: backup.blogs || []
    });
  }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const adminRes = await pgPool.query('SELECT * FROM admin WHERE username = $1', [username]);
    if (adminRes.rows.length === 0) return res.status(401).json({ error: 'Invalid username or password' });
    const row = adminRes.rows[0];
    if (bcrypt.compareSync(password, row.password)) {
      res.json({ success: true, token: 'admin-logged-in-session-token' });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function getTodayAndYesterdayDateStr() {
  const now = new Date();
  const kolkataFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayFull = kolkataFormatter.format(now); // e.g. "2026-08-24"
  const [tY, tM, tD] = todayFull.split('-');
  const todayStr = `${tD}-${tM}`; // e.g. "24-08"

  const kolkataNowParts = kolkataFormatter.formatToParts(now);
  let kYear = parseInt(kolkataNowParts.find(p => p.type === 'year').value, 10);
  let kMonth = parseInt(kolkataNowParts.find(p => p.type === 'month').value, 10) - 1;
  let kDay = parseInt(kolkataNowParts.find(p => p.type === 'day').value, 10);

  const kDateObj = new Date(Date.UTC(kYear, kMonth, kDay - 1));
  const yestFull = kolkataFormatter.format(kDateObj); // e.g. "2026-08-23"
  const [yY, yM, yD] = yestFull.split('-');
  const yestStr = `${yD}-${yM}`; // e.g. "23-08"

  return { todayStr, yestStr, todayFull, yestFull };
}

// Admin: Update Game Result (Today / Yesterday)
app.post('/api/admin/update-game', async (req, res) => {
  const { id, name, open_time, yesterday_result, today_result, is_hero, is_featured } = req.body;

  const backup = getBackupData();
  if (!backup) return res.status(500).json({ error: 'Backup system error' });
  if (!backup.games) backup.games = [];
  if (!backup.chart_records) backup.chart_records = [];

  let gNameUpper = (name || '').trim().toUpperCase();
  if (gNameUpper === 'DISAWER') gNameUpper = 'DISAWAR';

  const existingIdx = backup.games.findIndex(
    g => (g.id && id && String(g.id) === String(id)) ||
         (g.name || '').toUpperCase() === gNameUpper ||
         (gNameUpper === 'DISAWAR' && (g.name || '').toUpperCase().startsWith('DISAW'))
  );

  if (existingIdx !== -1) {
    if (gNameUpper) backup.games[existingIdx].name = gNameUpper;
    if (open_time !== undefined) backup.games[existingIdx].open_time = open_time;
    if (yesterday_result !== undefined) backup.games[existingIdx].yesterday_result = yesterday_result;
    if (today_result !== undefined) backup.games[existingIdx].today_result = today_result;
    if (is_hero !== undefined) backup.games[existingIdx].is_hero = is_hero ? 1 : 0;
    if (gNameUpper === 'DISAWAR') backup.games[existingIdx].is_permanent = 1;
  }

  const { todayStr, yestStr, todayFull, yestFull } = getTodayAndYesterdayDateStr();

  const updateChartBackup = (dateKey, gameName, val) => {
    const cIdx = backup.chart_records.findIndex(
      r => (r.record_date === dateKey) && (r.game_name || '').toUpperCase() === gameName
    );
    if (cIdx !== -1) {
      backup.chart_records[cIdx].result_val = val;
    } else {
      backup.chart_records.push({ record_date: dateKey, game_name: gameName, result_val: val });
    }
  };

  if (today_result && today_result.trim() !== '' && today_result.toUpperCase() !== 'WAIT') {
    updateChartBackup(todayStr, gNameUpper, today_result.trim());
    updateChartBackup(todayFull, gNameUpper, today_result.trim());
  }

  if (yesterday_result && yesterday_result.trim() !== '' && yesterday_result !== '-') {
    updateChartBackup(yestStr, gNameUpper, yesterday_result.trim());
    updateChartBackup(yestFull, gNameUpper, yesterday_result.trim());
  }

  if (!backup.settings) backup.settings = {};

  if (is_featured === 1 || is_featured === true || gNameUpper.startsWith('DISAW')) {
    backup.settings.featured_banner_game = gNameUpper;
    if (open_time !== undefined) backup.settings.disawer_time = open_time;
  }

  const heroGamesList = backup.games.filter(g => parseInt(g.is_hero) === 1).map(g => ({
    id: g.id || null,
    name: g.name ? g.name.trim().toUpperCase() : '',
    today_result: g.today_result ? g.today_result.trim() : 'WAIT'
  }));
  backup.settings.hero_games_json = JSON.stringify(heroGamesList);

  memoryBackupCache = backup;
  saveBackupDataLocally(backup);

  // Synchronous Awaited DB save
  try {
    const heroVal = is_hero !== undefined ? (is_hero ? 1 : 0) : 0;
    const isPermVal = gNameUpper === 'DISAWAR' ? 1 : 0;
    await safeQuery(
      `UPDATE games SET name = $1, yesterday_result = $2, today_result = $3, open_time = $4, is_hero = $5, is_permanent = GREATEST(is_permanent, $6) WHERE id = $7 OR UPPER(name) = UPPER($1) OR (UPPER(name) LIKE 'DISAW%' AND UPPER($1) LIKE 'DISAW%')`,
      [gNameUpper, yesterday_result, today_result, open_time, heroVal, isPermVal, id || -1]
    );

    if (is_featured === 1 || is_featured === true || gNameUpper.startsWith('DISAW')) {
      await safeQuery(`INSERT INTO site_settings (key, value) VALUES ('featured_banner_game', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [gNameUpper]).catch(() => {});
      if (open_time !== undefined) await safeQuery(`INSERT INTO site_settings (key, value) VALUES ('disawer_time', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [open_time]).catch(() => {});
    }

    if (heroGamesList.length > 0) {
      await safeQuery(`INSERT INTO site_settings (key, value) VALUES ('hero_games_json', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(heroGamesList)]).catch(() => {});
    }

    if (today_result && today_result.trim() !== '' && today_result.toUpperCase() !== 'WAIT') {
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [todayStr, gNameUpper, today_result.trim()]
      );
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [todayFull, gNameUpper, today_result.trim()]
      );
    }

    if (yesterday_result && yesterday_result.trim() !== '' && yesterday_result !== '-') {
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [yestStr, gNameUpper, yesterday_result.trim()]
      );
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [yestFull, gNameUpper, yesterday_result.trim()]
      );
    }
  } catch (e) {}

  memoryBackupCache = null;
  res.json({ success: true, message: 'Game updated successfully' });
});

// Admin: Add New Game
app.post('/api/admin/add-game', async (req, res) => {
  const { name, open_time, yesterday_result, today_result, table_group, is_hero, is_featured } = req.body;
  const grp = parseInt(table_group) || 1;
  let gName = (name || '').trim().toUpperCase();
  if (gName === 'DISAWER') gName = 'DISAWAR';
  if (!gName) return res.status(400).json({ error: 'Game name is required' });

  const heroVal = is_hero ? 1 : 0;
  const featVal = is_featured ? 1 : 0;
  const isPermVal = gName === 'DISAWAR' ? 1 : 0;

  const { todayStr, yestStr, todayFull, yestFull } = getTodayAndYesterdayDateStr();

  let dbInsertedGame = null;
  try {
    const dbRes = await safeQuery(
      `INSERT INTO games (name, open_time, close_time, yesterday_result, today_result, table_group, sort_order, is_hero, is_featured, is_permanent)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT MAX(sort_order) + 1 FROM games WHERE table_group = $6), 1), $7, $8, $9)
       ON CONFLICT (name) DO UPDATE SET
         open_time = EXCLUDED.open_time,
         yesterday_result = EXCLUDED.yesterday_result,
         today_result = EXCLUDED.today_result,
         table_group = EXCLUDED.table_group,
         is_hero = EXCLUDED.is_hero,
         is_featured = EXCLUDED.is_featured,
         is_permanent = GREATEST(games.is_permanent, EXCLUDED.is_permanent)
       RETURNING *`,
      [gName, open_time || '', open_time || '', yesterday_result || '', today_result || 'WAIT', grp, heroVal, featVal, isPermVal]
    );
    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      dbInsertedGame = dbRes.rows[0];
    }

    if (featVal === 1 || gName.startsWith('DISAW')) {
      await safeQuery(`INSERT INTO site_settings (key, value) VALUES ('featured_banner_game', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [gName]).catch(() => {});
    }

    if (today_result && today_result.trim() !== '' && today_result.toUpperCase() !== 'WAIT') {
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [todayStr, gName, today_result.trim()]
      );
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [todayFull, gName, today_result.trim()]
      );
    }

    if (yesterday_result && yesterday_result.trim() !== '' && yesterday_result !== '-') {
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [yestStr, gName, yesterday_result.trim()]
      );
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [yestFull, gName, yesterday_result.trim()]
      );
    }
  } catch (e) {
    console.error('Error inserting game into Supabase:', e);
  }

  if (dbInsertedGame) {
    if (!memoryBackupCache) memoryBackupCache = { settings: {}, games: [], chart_records: [], blogs: [] };
    if (!memoryBackupCache.games) memoryBackupCache.games = [];
    const idx = memoryBackupCache.games.findIndex(g => String(g.id) === String(dbInsertedGame.id) || (g.name || '').toUpperCase() === gName);
    if (idx !== -1) {
      memoryBackupCache.games[idx] = dbInsertedGame;
    } else {
      memoryBackupCache.games.push(dbInsertedGame);
    }
  } else {
    memoryBackupCache = null;
  }

  syncJSONBackup().catch(() => {});

  const finalId = dbInsertedGame ? dbInsertedGame.id : Date.now();
  console.log(`➕ [GAME CREATED IN DB]: id=${finalId}, name=${gName}`);
  res.json({ success: true, game: dbInsertedGame, id: finalId });
});

// Admin: Save Hero Box Games
app.post('/api/admin/update-hero-games', async (req, res) => {
  const { games } = req.body;
  if (!Array.isArray(games)) return res.status(400).json({ error: 'Invalid games array' });

  const heroItems = games.map(g => ({
    id: g.id || null,
    name: g.name ? g.name.trim().toUpperCase() : '',
    today_result: g.today_result ? g.today_result.trim() : 'WAIT'
  }));

  const heroJsonStr = JSON.stringify(heroItems);
  const heroNamesSet = new Set(heroItems.map(h => h.name.trim().toUpperCase()));

  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  if (!backup.settings) backup.settings = {};
  backup.settings.hero_games_json = heroJsonStr;

  if (Array.isArray(backup.games)) {
    backup.games.forEach(bg => {
      const bgName = (bg.name || '').trim().toUpperCase();
      const isH = heroNamesSet.has(bgName) || Array.from(heroNamesSet).some(hn => hn.startsWith('DISAW') && bgName.startsWith('DISAW'));
      bg.is_hero = isH ? 1 : 0;
      const matchedItem = heroItems.find(h => h.name.trim().toUpperCase() === bgName || (h.name.trim().toUpperCase().startsWith('DISAW') && bgName.startsWith('DISAW')));
      if (matchedItem && matchedItem.today_result && matchedItem.today_result !== 'WAIT') {
        bg.today_result = matchedItem.today_result;
      }
    });
  }

  memoryBackupCache = backup;
  saveBackupDataLocally(backup);

  // Synchronous Awaited DB update
  try {
    await safeQuery('UPDATE games SET is_hero = 0');
    await safeQuery(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      ['hero_games_json', heroJsonStr]
    );
    for (const g of heroItems) {
      await safeQuery(
        `UPDATE games SET is_hero = 1, today_result = $1 WHERE id = $2 OR UPPER(name) = UPPER($3) OR (UPPER(name) LIKE 'DISAW%' AND UPPER($3) LIKE 'DISAW%')`,
        [g.today_result, g.id || -1, g.name]
      );
    }
  } catch (e) {}

  memoryBackupCache = null;
  res.json({ success: true, message: 'Hero Box Games updated successfully' });
});

// Admin: Batch Reorder Games (Save Custom Order)
app.post('/api/admin/reorder-games', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order array' });

  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  if (!backup.games) backup.games = [];

  order.forEach(item => {
    const existingIdx = backup.games.findIndex(g => g.id === item.id || (g.name || '').toUpperCase() === (item.name || '').toUpperCase());
    if (existingIdx !== -1) {
      backup.games[existingIdx].sort_order = parseInt(item.sort_order) || 0;
    }
  });

  backup.games.sort((a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0));
  saveBackupDataLocally(backup);

  for (const item of order) {
    try {
      await safeQuery('UPDATE games SET sort_order = $1 WHERE id = $2 OR UPPER(name) = UPPER($3)', [item.sort_order, item.id || -1, item.name || '']);
    } catch (e) {}
  }

  res.json({ success: true, message: 'Games reordered successfully' });
});

// Admin: Save/Update Batch Games (Saves all details + order for multiple games at once)
app.post('/api/admin/update-games-batch', async (req, res) => {
  const { games } = req.body;
  if (!Array.isArray(games) || games.length === 0) return res.json({ success: true, count: 0 });

  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  if (!backup.games) backup.games = [];
  if (!backup.chart_records) backup.chart_records = [];

  const { todayStr, yestStr, todayFull, yestFull } = getTodayAndYesterdayDateStr();

  const updateChartBackup = (dateKey, gameName, val) => {
    const cIdx = backup.chart_records.findIndex(
      r => (r.record_date === dateKey) && (r.game_name || '').toUpperCase() === gameName
    );
    if (cIdx !== -1) {
      backup.chart_records[cIdx].result_val = val;
    } else {
      backup.chart_records.push({ record_date: dateKey, game_name: gameName, result_val: val });
    }
  };

  games.forEach(g => {
    if (!g.name) return;
    let gNameUpper = g.name.trim().toUpperCase();
    if (gNameUpper === 'DISAWER') gNameUpper = 'DISAWAR';
    const isPermVal = gNameUpper === 'DISAWAR' ? 1 : 0;

    const existingIdx = backup.games.findIndex(
      bg => (bg.id && g.id && String(bg.id) === String(g.id)) || (bg.name || '').toUpperCase() === gNameUpper || (gNameUpper === 'DISAWAR' && (bg.name || '').toUpperCase().startsWith('DISAW'))
    );

    const updatedGame = {
      id: g.id || (existingIdx !== -1 ? backup.games[existingIdx].id : Date.now()),
      name: gNameUpper,
      open_time: g.open_time !== undefined ? g.open_time : '',
      yesterday_result: g.yesterday_result !== undefined ? g.yesterday_result : '',
      today_result: g.today_result !== undefined ? g.today_result : 'WAIT',
      table_group: parseInt(g.table_group) || 1,
      sort_order: parseInt(g.sort_order) || 0,
      is_hero: g.is_hero !== undefined ? (g.is_hero ? 1 : 0) : (existingIdx !== -1 ? (backup.games[existingIdx].is_hero || 0) : 0),
      is_featured: g.is_featured !== undefined ? (g.is_featured ? 1 : 0) : (existingIdx !== -1 ? (backup.games[existingIdx].is_featured || 0) : 0),
      is_permanent: isPermVal || (existingIdx !== -1 ? (backup.games[existingIdx].is_permanent || 0) : 0)
    };

    if (g.is_featured === 1 || g.is_featured === true || gNameUpper.startsWith('DISAW')) {
      if (!backup.settings) backup.settings = {};
      backup.settings.featured_banner_game = gNameUpper;
      if (g.open_time !== undefined) backup.settings.disawer_time = g.open_time;
    }

    if (existingIdx !== -1) {
      backup.games[existingIdx] = { ...backup.games[existingIdx], ...updatedGame };
    } else {
      backup.games.push(updatedGame);
    }

    if (g.today_result && g.today_result.trim() !== '' && g.today_result.toUpperCase() !== 'WAIT') {
      updateChartBackup(todayStr, gNameUpper, g.today_result.trim());
      updateChartBackup(todayFull, gNameUpper, g.today_result.trim());
    }

    if (g.yesterday_result && g.yesterday_result.trim() !== '' && g.yesterday_result !== '-') {
      updateChartBackup(yestStr, gNameUpper, g.yesterday_result.trim());
      updateChartBackup(yestFull, gNameUpper, g.yesterday_result.trim());
    }
  });

  backup.games.sort((a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0));

  const heroGamesList = backup.games.filter(g => parseInt(g.is_hero) === 1).map(g => ({
    id: g.id || null,
    name: g.name ? g.name.trim().toUpperCase() : '',
    today_result: g.today_result ? g.today_result.trim() : 'WAIT'
  }));
  if (!backup.settings) backup.settings = {};
  backup.settings.hero_games_json = JSON.stringify(heroGamesList);

  memoryBackupCache = backup;
  saveBackupDataLocally(backup);

  for (const g of games) {
    if (g.id || g.name) {
      let gNameUpper = (g.name || '').trim().toUpperCase();
      if (gNameUpper === 'DISAWER') gNameUpper = 'DISAWAR';
      const heroVal = g.is_hero !== undefined ? (g.is_hero ? 1 : 0) : 0;
      const featVal = g.is_featured !== undefined ? (g.is_featured ? 1 : 0) : 0;
      const isPermVal = gNameUpper === 'DISAWAR' ? 1 : 0;

      try {
        await safeQuery(
          `UPDATE games SET name = $1, open_time = $2, yesterday_result = $3, today_result = $4, sort_order = $5, is_hero = $6, is_featured = $7, is_permanent = GREATEST(is_permanent, $8) WHERE id = $9 OR UPPER(name) = UPPER($1) OR (UPPER(name) LIKE 'DISAW%' AND UPPER($1) LIKE 'DISAW%')`,
          [gNameUpper, g.open_time || '', g.yesterday_result || '', g.today_result || 'WAIT', g.sort_order || 0, heroVal, featVal, isPermVal, g.id || -1]
        );
        if (g.today_result && g.today_result.trim() !== '' && g.today_result.toUpperCase() !== 'WAIT') {
          await safeQuery(
            `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
             ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
            [todayStr, gNameUpper, g.today_result.trim()]
          );
          await safeQuery(
            `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
             ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
            [todayFull, gNameUpper, g.today_result.trim()]
          );
        }

        if (g.yesterday_result && g.yesterday_result.trim() !== '' && g.yesterday_result !== '-') {
          await safeQuery(
            `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
             ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
            [yestStr, gNameUpper, g.yesterday_result.trim()]
          );
          await safeQuery(
            `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
             ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
            [yestFull, gNameUpper, g.yesterday_result.trim()]
          );
        }
      } catch (e) {}
    }
  }

  res.json({ success: true, count: games.length });
});

// Admin: Delete Game
app.post('/api/admin/delete-game', async (req, res) => {
  const { id, name } = req.body;
  const nameUpper = (name || '').trim().toUpperCase();
  const idStr = id ? String(id) : '';

  const backup = getBackupData();
  const targetBackupGame = backup && backup.games ? backup.games.find(g => (idStr !== '' && String(g.id || '') === idStr) || ((g.name || '').toUpperCase() === nameUpper)) : null;

  if (nameUpper === 'DISAWAR' || nameUpper === 'DISAWER' || nameUpper.startsWith('DISAW') || (targetBackupGame && (targetBackupGame.is_permanent || (targetBackupGame.name || '').toUpperCase().startsWith('DISAW')))) {
    return res.status(400).json({ error: 'DISAWAR is a permanent system game and cannot be deleted.' });
  }

  if (backup && backup.games) {
    backup.games = backup.games.filter(g => {
      const matchId = idStr !== '' && String(g.id || '') === idStr;
      const matchName = nameUpper !== '' && (g.name || '').toUpperCase() === nameUpper;
      return !(matchId || matchName);
    });

    if (backup.settings && backup.settings.hero_games_json) {
      try {
        const currentHero = JSON.parse(backup.settings.hero_games_json);
        const filteredHero = currentHero.filter(h => {
          const matchId = idStr !== '' && String(h.id || '') === idStr;
          const matchName = nameUpper !== '' && (h.name || '').toUpperCase() === nameUpper;
          return !(matchId || matchName);
        });
        backup.settings.hero_games_json = JSON.stringify(filteredHero);
        await safeQuery(
          `INSERT INTO site_settings (key, value) VALUES ('hero_games_json', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [backup.settings.hero_games_json]
        ).catch(() => {});
      } catch (e) {}
    }

    memoryBackupCache = backup;
    saveBackupDataLocally(backup);
  }

  try {
    await safeQuery('DELETE FROM games WHERE (id = $1 OR UPPER(name) = UPPER($2)) AND UPPER(name) NOT LIKE \'DISAW%\' AND COALESCE(is_permanent, 0) = 0', [id || -1, name || '']);
  } catch (e) {}

  if (memoryBackupCache && Array.isArray(memoryBackupCache.games)) {
    memoryBackupCache.games = memoryBackupCache.games.filter(g => {
      const matchId = idStr !== '' && String(g.id || '') === idStr;
      const matchName = nameUpper !== '' && (g.name || '').toUpperCase() === nameUpper;
      return !(matchId || matchName);
    });
  }

  syncJSONBackup().catch(() => {});
  console.log(`🗑️ [GAME DELETED PERMANENTLY]: id=${id}, name=${name}`);
  res.json({ success: true, message: 'Game permanently deleted' });
});

// Admin: Clear All Games (Preserves Permanent DISAWER)
app.post('/api/admin/clear-all-games', async (req, res) => {
  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  backup.games = (backup.games || []).filter(g => (g.name || '').toUpperCase().startsWith('DISAW'));
  if (!backup.settings) backup.settings = {};
  backup.settings.hero_games_json = "[]";
  backup.settings.custom_chart_cards_json = "[]";
  delete backup.settings.chart1_columns_json;
  delete backup.settings.chart2_columns_json;

  memoryBackupCache = backup;
  saveBackupDataLocally(backup);

  try {
    await safeQuery("DELETE FROM games WHERE UPPER(name) NOT LIKE 'DISAW%'");
    await safeQuery(`INSERT INTO site_settings (key, value) VALUES ('hero_games_json', '[]') ON CONFLICT (key) DO UPDATE SET value = '[]'`).catch(() => {});
    await safeQuery(`INSERT INTO site_settings (key, value) VALUES ('custom_chart_cards_json', '[]') ON CONFLICT (key) DO UPDATE SET value = '[]'`).catch(() => {});
  } catch (e) {}

  res.json({ success: true, message: 'All custom games cleared successfully (Permanent DISAWER preserved)' });
});

// Admin: Save/Update Single Chart Cell
app.post('/api/admin/update-chart-cell', async (req, res) => {
  const { record_date, game_name, result_val } = req.body;
  try {
    await safeQuery(
      `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
       ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
      [record_date, game_name, result_val]
    );

    const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
    if (!backup.chart_records) backup.chart_records = [];
    const gNameUpper = (game_name || '').trim().toUpperCase();
    const cIdx = backup.chart_records.findIndex(r => r.record_date === record_date && (r.game_name || '').toUpperCase() === gNameUpper);
    if (cIdx !== -1) {
      backup.chart_records[cIdx].result_val = result_val;
    } else {
      backup.chart_records.push({ record_date, game_name: gNameUpper, result_val });
    }
    saveBackupDataLocally(backup);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: Save/Update Batch Chart Cells (Instant High-Speed Save)
app.post('/api/admin/update-chart-batch', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.json({ success: true, count: 0 });

  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  if (!backup.chart_records) backup.chart_records = [];

  items.forEach(item => {
    const existingIdx = backup.chart_records.findIndex(
      r => r.record_date === item.record_date && (r.game_name || '').toUpperCase() === (item.game_name || '').toUpperCase()
    );
    if (existingIdx !== -1) {
      backup.chart_records[existingIdx].result_val = item.result_val;
    } else {
      backup.chart_records.push({ record_date: item.record_date, game_name: item.game_name, result_val: item.result_val });
    }
  });

  memoryBackupCache = backup;
  saveBackupDataLocally(backup);

  for (const item of items) {
    try {
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [item.record_date, item.game_name, item.result_val]
      );
    } catch (e) {}
  }

  res.json({ success: true, count: items.length });
});

// Admin: Save Settings (Ticker, Hindi tagline, Links, Khaiwal Cards, etc.)
app.post('/api/admin/update-settings', async (req, res) => {
  const settings = req.body;

  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  if (!backup.settings) backup.settings = {};
  for (const [key, value] of Object.entries(settings)) {
    backup.settings[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  memoryBackupCache = backup;
  saveBackupDataLocally(backup);

  for (const [key, value] of Object.entries(settings)) {
    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    try {
      await safeQuery(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, valStr]
      );
    } catch (e) {}
  }

  memoryBackupCache = null;
  res.json({ success: true, message: 'Settings saved successfully' });
});

// Admin: Save/Update Blog Post
app.post('/api/admin/save-blog', async (req, res) => {
  const { id, title, slug, image, post_date, tags, content } = req.body;
  try {
    if (id) {
      await pgPool.query(
        'UPDATE blogs SET title=$1, slug=$2, image=$3, post_date=$4, tags=$5, content=$6 WHERE id=$7',
        [title, slug, image, post_date, tags, content, id]
      );
    } else {
      await pgPool.query(
        'INSERT INTO blogs (title, slug, image, post_date, tags, content) VALUES ($1, $2, $3, $4, $5, $6)',
        [title, slug, image, post_date, tags, content]
      );
    }
    await syncJSONBackup();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: Delete Blog Post
app.post('/api/admin/delete-blog', async (req, res) => {
  const { id } = req.body;
  try {
    await pgPool.query('DELETE FROM blogs WHERE id = $1', [id]);
    await syncJSONBackup();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: Change Password
app.post('/api/admin/change-password', async (req, res) => {
  const { new_password } = req.body;
  const hash = bcrypt.hashSync(new_password, 10);
  try {
    await pgPool.query("UPDATE admin SET password = $1 WHERE username = 'A77SattaOfficial'", [hash]);
    await syncJSONBackup();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Clean URL Routes
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/chart', (req, res) => res.sendFile(path.join(__dirname, 'chart.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`A77Satta Server running at http://localhost:${PORT}`);
    console.log(`Admin panel at http://localhost:${PORT}/admin`);
  });
}

module.exports = app;
