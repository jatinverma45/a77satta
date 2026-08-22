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
  max: 2,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 2500
});

function safeQuery(text, params = []) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error('PostgreSQL query timeout (5s limit)'));
      }
    }, 5000);

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
    const backup = getBackupData() || {};
    const settingsRes = await safeQuery('SELECT key, value FROM site_settings').catch(() => null);
    const gamesRes = await safeQuery('SELECT * FROM games ORDER BY sort_order ASC, id ASC').catch(() => null);
    const chartsRes = await safeQuery('SELECT * FROM chart_records ORDER BY record_date ASC').catch(() => null);
    const blogsRes = await safeQuery('SELECT * FROM blogs ORDER BY id DESC').catch(() => null);

    const fullData = {
      settings: backup.settings || {},
      games: backup.games || [],
      chart_records: backup.chart_records || [],
      blogs: backup.blogs || []
    };

    if (settingsRes && settingsRes.rows) {
      settingsRes.rows.forEach(s => {
        if (!fullData.settings[s.key]) fullData.settings[s.key] = s.value;
      });
    }

    if (gamesRes && gamesRes.rows && gamesRes.rows.length > 0) {
      const gameMap = {};
      (backup.games || []).forEach(g => {
        if (g && g.name) gameMap[g.id || g.name.trim().toUpperCase()] = g;
      });
      gamesRes.rows.forEach(g => {
        if (g && g.name) {
          const key = g.id || g.name.trim().toUpperCase();
          gameMap[key] = { ...(gameMap[key] || {}), ...g };
        }
      });
      fullData.games = Object.values(gameMap);
      fullData.games.sort((a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0));
    }

    delete fullData.settings.chart2_columns_json;
    const jsonStr = JSON.stringify(fullData, null, 2);
    try {
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
        is_hero INT DEFAULT 0
      );

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
    let settingsRes = await safeQuery('SELECT key, value FROM site_settings').catch(() => null);
    let gamesRes = await safeQuery('SELECT * FROM games ORDER BY sort_order ASC, id ASC').catch(() => null);
    let chartsRes = await safeQuery('SELECT * FROM chart_records ORDER BY record_date ASC').catch(() => null);
    let blogsRes = await safeQuery('SELECT * FROM blogs ORDER BY id DESC').catch(() => null);

    const backup = getBackupData();
    let settings = { ...(backup.settings || {}) };
    delete settings.chart2_columns_json;

    if (settingsRes && settingsRes.rows) {
      settingsRes.rows.forEach(s => settings[s.key] = s.value);
    }

    let games = [];
    if (gamesRes && gamesRes.rows && gamesRes.rows.length > 0) {
      games = gamesRes.rows;
    } else if (backup.games && backup.games.length > 0) {
      games = backup.games;
    }
    games.sort((a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0));

    let charts = [];
    if (chartsRes && chartsRes.rows && chartsRes.rows.length > 0) {
      charts = chartsRes.rows;
    } else if (backup.chart_records && backup.chart_records.length > 0) {
      charts = backup.chart_records;
    }

    let blogs = (blogsRes && blogsRes.rows && blogsRes.rows.length > 0) ? blogsRes.rows : (backup.blogs || []);

    let heroGames = [];
    if (settings.hero_games_json) {
      try {
        const parsed = typeof settings.hero_games_json === 'string'
          ? JSON.parse(settings.hero_games_json)
          : settings.hero_games_json;
        if (Array.isArray(parsed) && parsed.length > 0) heroGames = parsed;
      } catch (e) {}
    }
    if (!heroGames || heroGames.length === 0) {
      heroGames = games.filter(g => g.is_hero === 1);
    }
    if (!heroGames || heroGames.length === 0) {
      heroGames = [
        { name: 'DISAWAR', today_result: 'WAIT' },
        { name: 'GALI', today_result: 'WAIT' }
      ];
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
    return res.json({
      settings: backup.settings || {},
      games: backup.games || [],
      hero_games: (backup.games || []).filter(g => g.is_hero === 1),
      chart_records: backup.chart_records || [],
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
  const dayToday = String(now.getDate()).padStart(2, '0');
  const monthToday = String(now.getMonth() + 1).padStart(2, '0');
  const todayStr = `${dayToday}-${monthToday}`;

  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const dayYest = String(yest.getDate()).padStart(2, '0');
  const monthYest = String(yest.getMonth() + 1).padStart(2, '0');
  const yestStr = `${dayYest}-${monthYest}`;

  return { todayStr, yestStr };
}

// Admin: Update Game Result (Today / Yesterday)
app.post('/api/admin/update-game', async (req, res) => {
  const { id, name, open_time, yesterday_result, today_result } = req.body;

  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  if (!backup.games) backup.games = [];
  if (!backup.chart_records) backup.chart_records = [];

  const gNameUpper = (name || '').trim().toUpperCase();
  const existingIdx = backup.games.findIndex(
    g => (g.id && id && g.id === id) ||
         (g.name || '').toUpperCase() === gNameUpper ||
         ((g.name || '').toUpperCase().startsWith('DISAW') && gNameUpper.startsWith('DISAW'))
  );

  if (existingIdx !== -1) {
    if (gNameUpper) backup.games[existingIdx].name = gNameUpper;
    if (open_time !== undefined) backup.games[existingIdx].open_time = open_time;
    if (yesterday_result !== undefined) backup.games[existingIdx].yesterday_result = yesterday_result;
    if (today_result !== undefined) backup.games[existingIdx].today_result = today_result;
  }

  const { todayStr, yestStr } = getTodayAndYesterdayDateStr();

  if (today_result && today_result.trim() !== '' && today_result !== 'WAIT') {
    const cIdx = backup.chart_records.findIndex(
      r => r.record_date === todayStr && (r.game_name || '').toUpperCase() === gNameUpper
    );
    if (cIdx !== -1) {
      backup.chart_records[cIdx].result_val = today_result.trim();
    } else {
      backup.chart_records.push({ record_date: todayStr, game_name: gNameUpper, result_val: today_result.trim() });
    }
  } else {
    backup.chart_records = backup.chart_records.filter(
      r => !(r.record_date === todayStr && (r.game_name || '').toUpperCase() === gNameUpper)
    );
  }

  if (yesterday_result && yesterday_result.trim() !== '' && yesterday_result !== '-') {
    const cIdx = backup.chart_records.findIndex(
      r => r.record_date === yestStr && (r.game_name || '').toUpperCase() === gNameUpper
    );
    if (cIdx !== -1) {
      backup.chart_records[cIdx].result_val = yesterday_result.trim();
    } else {
      backup.chart_records.push({ record_date: yestStr, game_name: gNameUpper, result_val: yesterday_result.trim() });
    }
  } else {
    backup.chart_records = backup.chart_records.filter(
      r => !(r.record_date === yestStr && (r.game_name || '').toUpperCase() === gNameUpper)
    );
  }

  saveBackupDataLocally(backup);

  // Synchronous Awaited DB save
  try {
    await safeQuery(
      `UPDATE games SET name = $1, yesterday_result = $2, today_result = $3, open_time = $4 WHERE id = $5 OR UPPER(name) = UPPER($1) OR (UPPER(name) LIKE 'DISAW%' AND UPPER($1) LIKE 'DISAW%')`,
      [name, yesterday_result, today_result, open_time, id || -1]
    );
    if (today_result && today_result.trim() !== '' && today_result !== 'WAIT') {
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [todayStr, name, today_result.trim()]
      );
    }

    if (yesterday_result && yesterday_result.trim() !== '' && yesterday_result !== '-') {
      await safeQuery(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [yestStr, name, yesterday_result.trim()]
      );
    }
  } catch (e) {}

  res.json({ success: true, message: 'Game updated successfully' });
});

// Admin: Add New Game
app.post('/api/admin/add-game', async (req, res) => {
  const { name, open_time, yesterday_result, today_result, table_group } = req.body;
  const grp = parseInt(table_group) || 1;
  const gName = (name || '').trim().toUpperCase();
  if (!gName) return res.status(400).json({ error: 'Game name is required' });

  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  if (!backup.games) backup.games = [];

  const grpGames = backup.games.filter(g => parseInt(g.table_group) === grp);
  const nextOrd = grpGames.length + 1;
  const newId = Date.now();

  const newGameObj = {
    id: newId,
    name: gName,
    open_time: open_time || '',
    yesterday_result: yesterday_result || '',
    today_result: today_result || 'WAIT',
    table_group: grp,
    sort_order: nextOrd
  };

  const existingIdx = backup.games.findIndex(g => (g.name || '').toUpperCase() === gName);
  if (existingIdx !== -1) {
    backup.games[existingIdx] = { ...backup.games[existingIdx], ...newGameObj };
  } else {
    backup.games.push(newGameObj);
  }

  saveBackupDataLocally(backup);

  // Synchronous Awaited DB save
  try {
    await safeQuery(
      `INSERT INTO games (name, open_time, close_time, yesterday_result, today_result, table_group, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name) DO UPDATE SET
         open_time = EXCLUDED.open_time,
         yesterday_result = EXCLUDED.yesterday_result,
         today_result = EXCLUDED.today_result,
         table_group = EXCLUDED.table_group,
         sort_order = EXCLUDED.sort_order`,
      [gName, open_time || '', open_time || '', yesterday_result || '', today_result || 'WAIT', grp, nextOrd]
    );
  } catch (e) {}

  res.json({ success: true, id: newId });
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

  const backup = getBackupData() || { settings: {}, games: [], chart_records: [], blogs: [] };
  if (!backup.settings) backup.settings = {};
  backup.settings.hero_games_json = heroJsonStr;
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
        'UPDATE games SET is_hero = 1, today_result = $1 WHERE id = $2 OR UPPER(name) = $3',
        [g.today_result, g.id || -1, g.name]
      );
    }
  } catch (e) {}

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

  const { todayStr, yestStr } = getTodayAndYesterdayDateStr();

  games.forEach(g => {
    if (!g.name) return;
    const gNameUpper = g.name.trim().toUpperCase();
    const existingIdx = backup.games.findIndex(
      bg => (bg.id && g.id && bg.id === g.id) || (bg.name || '').toUpperCase() === gNameUpper
    );

    const updatedGame = {
      id: g.id || (existingIdx !== -1 ? backup.games[existingIdx].id : Date.now()),
      name: gNameUpper,
      open_time: g.open_time !== undefined ? g.open_time : '',
      yesterday_result: g.yesterday_result !== undefined ? g.yesterday_result : '',
      today_result: g.today_result !== undefined ? g.today_result : 'WAIT',
      table_group: parseInt(g.table_group) || 1,
      sort_order: parseInt(g.sort_order) || 0
    };

    if (existingIdx !== -1) {
      backup.games[existingIdx] = { ...backup.games[existingIdx], ...updatedGame };
    } else {
      backup.games.push(updatedGame);
    }

    if (g.today_result && g.today_result.trim() !== '' && g.today_result !== 'WAIT') {
      const cIdx = backup.chart_records.findIndex(
        r => r.record_date === todayStr && (r.game_name || '').toUpperCase() === gNameUpper
      );
      if (cIdx !== -1) {
        backup.chart_records[cIdx].result_val = g.today_result.trim();
      } else {
        backup.chart_records.push({ record_date: todayStr, game_name: gNameUpper, result_val: g.today_result.trim() });
      }
    } else {
      backup.chart_records = backup.chart_records.filter(
        r => !(r.record_date === todayStr && (r.game_name || '').toUpperCase() === gNameUpper)
      );
    }

    if (g.yesterday_result && g.yesterday_result.trim() !== '' && g.yesterday_result !== '-') {
      const cIdx = backup.chart_records.findIndex(
        r => r.record_date === yestStr && (r.game_name || '').toUpperCase() === gNameUpper
      );
      if (cIdx !== -1) {
        backup.chart_records[cIdx].result_val = g.yesterday_result.trim();
      } else {
        backup.chart_records.push({ record_date: yestStr, game_name: gNameUpper, result_val: g.yesterday_result.trim() });
      }
    } else {
      backup.chart_records = backup.chart_records.filter(
        r => !(r.record_date === yestStr && (r.game_name || '').toUpperCase() === gNameUpper)
      );
    }
  });

  backup.games.sort((a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0));
  saveBackupDataLocally(backup);

  for (const g of games) {
    if (g.id || g.name) {
      const gNameUpper = (g.name || '').trim().toUpperCase();
      try {
        await safeQuery(
          `UPDATE games SET name = $1, open_time = $2, yesterday_result = $3, today_result = $4, sort_order = $5 WHERE id = $6 OR UPPER(name) = UPPER($1)`,
          [gNameUpper, g.open_time || '', g.yesterday_result || '', g.today_result || 'WAIT', g.sort_order || 0, g.id || -1]
        );
        if (g.today_result && g.today_result.trim() !== '' && g.today_result !== 'WAIT') {
          await safeQuery(
            `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
             ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
            [todayStr, gNameUpper, g.today_result.trim()]
          );
        }

        if (g.yesterday_result && g.yesterday_result.trim() !== '' && g.yesterday_result !== '-') {
          await safeQuery(
            `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
             ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
            [yestStr, gNameUpper, g.yesterday_result.trim()]
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

  const backup = getBackupData();
  if (backup && backup.games) {
    const nameUpper = (name || '').trim().toUpperCase();
    backup.games = backup.games.filter(g => g.id !== id && (nameUpper === '' || (g.name || '').toUpperCase() !== nameUpper));
    saveBackupDataLocally(backup);
  }

  try {
    await safeQuery('DELETE FROM games WHERE id = $1 OR UPPER(name) = UPPER($2)', [id || -1, name || '']);
  } catch (e) {}

  res.json({ success: true });
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

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`A77Satta Server running at http://localhost:${PORT}`);
    console.log(`Admin panel at http://localhost:${PORT}/admin`);
  });
}

module.exports = app;
