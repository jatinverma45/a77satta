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
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const SUPABASE_DB_URI = process.env.SUPABASE_DB_URI || 'postgresql://postgres:SattaaA77king@db.sszqmfagodieabgsbzev.supabase.co:5432/postgres';

const pgPool = new PgPool({
  connectionString: SUPABASE_DB_URI,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

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
    const settingsRes = await pgPool.query('SELECT key, value FROM site_settings');
    const gamesRes = await pgPool.query('SELECT * FROM games ORDER BY sort_order ASC, id ASC');
    const chartsRes = await pgPool.query('SELECT * FROM chart_records ORDER BY record_date ASC');
    const blogsRes = await pgPool.query('SELECT * FROM blogs ORDER BY id DESC');

    const fullData = {
      settings: {},
      games: gamesRes.rows || [],
      chart_records: chartsRes.rows || [],
      blogs: blogsRes.rows || []
    };

    (settingsRes.rows || []).forEach(s => fullData.settings[s.key] = s.value);

    const jsonStr = JSON.stringify(fullData, null, 2);
    try {
      fs.writeFileSync(tmpBackupPath, jsonStr);
      if (tmpBackupPath !== bundledBackupPath) {
        try { fs.writeFileSync(bundledBackupPath, jsonStr); } catch (e) {}
      }
    } catch (e) {}
    return true;
  } catch (e) {
    console.error('Error syncing backup file:', e.message);
    return false;
  }
}

// Database Initialization Middleware
let isDbReady = false;
async function initDatabase() {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        open_time VARCHAR(100),
        close_time VARCHAR(100),
        yesterday_result VARCHAR(50) DEFAULT '',
        today_result VARCHAR(50) DEFAULT 'WAIT',
        table_group INT DEFAULT 1,
        sort_order INT DEFAULT 0,
        is_hero INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS chart_records (
        id SERIAL PRIMARY KEY,
        record_date VARCHAR(50) NOT NULL,
        game_name VARCHAR(255) NOT NULL,
        result_val VARCHAR(50) NOT NULL,
        CONSTRAINT unique_date_game UNIQUE(record_date, game_name)
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

// Public: Get all site data for homepage & chart page
app.get('/api/site-data', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const settingsRes = await pgPool.query('SELECT key, value FROM site_settings');
    const gamesRes = await pgPool.query('SELECT * FROM games ORDER BY sort_order ASC, id ASC');
    const chartsRes = await pgPool.query('SELECT * FROM chart_records ORDER BY record_date ASC');
    const blogsRes = await pgPool.query('SELECT * FROM blogs ORDER BY id DESC');

    const settings = {};
    (settingsRes.rows || []).forEach(s => settings[s.key] = s.value);

    const games = gamesRes.rows || [];
    let heroGames = games.filter(g => g.is_hero === 1);
    if (heroGames.length === 0 && settings.hero_games_json) {
      try { heroGames = JSON.parse(settings.hero_games_json); } catch (e) {}
    }
    if (!heroGames || heroGames.length === 0) {
      heroGames = [
        { name: 'RAJ SHREE', today_result: 'WAIT' },
        { name: 'UDAIPUR CITY', today_result: 'WAIT' }
      ];
    }

    return res.json({
      settings,
      games,
      hero_games: heroGames,
      chart_records: chartsRes.rows || [],
      blogs: blogsRes.rows || []
    });
  } catch (e) {
    console.error('PostgreSQL API error:', e.message);
    res.status(500).json({ error: e.message });
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

// Admin: Update Game Result (Today / Yesterday)
app.post('/api/admin/update-game', async (req, res) => {
  const { id, name, open_time, yesterday_result, today_result } = req.body;
  try {
    await pgPool.query(
      'UPDATE games SET name = $1, yesterday_result = $2, today_result = $3, open_time = $4 WHERE id = $5',
      [name, yesterday_result, today_result, open_time, id]
    );

    if (today_result && today_result.trim() !== '' && today_result !== 'WAIT') {
      const todayDateStr = '09-08';
      await pgPool.query(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [todayDateStr, name, today_result.trim()]
      );
    }

    await syncJSONBackup();
    res.json({ success: true, message: 'Game updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: Add New Game
app.post('/api/admin/add-game', async (req, res) => {
  const { name, open_time, yesterday_result, today_result, table_group } = req.body;
  try {
    const pgRes = await pgPool.query(
      `INSERT INTO games (name, open_time, close_time, yesterday_result, today_result, table_group, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, 99) RETURNING id`,
      [name, open_time, open_time, yesterday_result || '', today_result || 'WAIT', table_group || 1]
    );
    await syncJSONBackup();
    res.json({ success: true, id: pgRes.rows[0] ? pgRes.rows[0].id : Date.now() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: Save / Update Hero Box Games List
app.post('/api/admin/update-hero-games', async (req, res) => {
  const { games } = req.body;
  if (!Array.isArray(games)) return res.status(400).json({ error: 'Invalid games array' });

  try {
    await pgPool.query('UPDATE games SET is_hero = 0');
    const heroItems = games.map(g => ({
      id: g.id || null,
      name: g.name ? g.name.trim().toUpperCase() : '',
      today_result: g.today_result ? g.today_result.trim() : 'WAIT'
    }));

    const heroJsonStr = JSON.stringify(heroItems);
    await pgPool.query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      ['hero_games_json', heroJsonStr]
    );

    for (const g of heroItems) {
      await pgPool.query(
        'UPDATE games SET is_hero = 1, today_result = $1 WHERE id = $2 OR UPPER(name) = $3',
        [g.today_result, g.id || -1, g.name]
      );
    }

    await syncJSONBackup();
    res.json({ success: true, message: 'Hero Box Games updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: Batch Reorder Games (Save Custom Order)
app.post('/api/admin/reorder-games', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order array' });

  try {
    for (const item of order) {
      await pgPool.query('UPDATE games SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
    }
    await syncJSONBackup();
    res.json({ success: true, message: 'Games reordered successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: Save/Update Batch Games (Saves all details + order for multiple games at once)
app.post('/api/admin/update-games-batch', async (req, res) => {
  const { games } = req.body;
  if (!Array.isArray(games) || games.length === 0) return res.json({ success: true, count: 0 });

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const todayDateStr = '09-08';

    for (const g of games) {
      if (g.id) {
        await client.query(
          `UPDATE games SET name = $1, open_time = $2, yesterday_result = $3, today_result = $4, sort_order = $5 WHERE id = $6`,
          [g.name || '', g.open_time || '', g.yesterday_result || '', g.today_result || 'WAIT', g.sort_order || 0, g.id]
        );
        if (g.today_result && g.today_result.trim() !== '' && g.today_result !== 'WAIT') {
          await client.query(
            `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
             ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
            [todayDateStr, g.name, g.today_result.trim()]
          );
        }
      }
    }
    await client.query('COMMIT');
    await syncJSONBackup();
    res.json({ success: true, count: games.length });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Admin: Delete Game
app.post('/api/admin/delete-game', async (req, res) => {
  const { id } = req.body;
  try {
    await pgPool.query('DELETE FROM games WHERE id = $1', [id]);
    await syncJSONBackup();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: Save/Update Single Chart Cell
app.post('/api/admin/update-chart-cell', async (req, res) => {
  const { record_date, game_name, result_val } = req.body;
  try {
    await pgPool.query(
      `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
       ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
      [record_date, game_name, result_val]
    );
    await syncJSONBackup();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: Save/Update Batch Chart Cells (Instant High-Speed Save)
app.post('/api/admin/update-chart-batch', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.json({ success: true, count: 0 });

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query(
        `INSERT INTO chart_records (record_date, game_name, result_val) VALUES ($1, $2, $3)
         ON CONFLICT (record_date, game_name) DO UPDATE SET result_val = EXCLUDED.result_val`,
        [item.record_date, item.game_name, item.result_val]
      );
    }
    await client.query('COMMIT');
    await syncJSONBackup();
    res.json({ success: true, count: items.length });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Admin: Save Settings (Ticker, Hindi tagline, Links, etc.)
app.post('/api/admin/update-settings', async (req, res) => {
  const settings = req.body;
  try {
    for (const [key, value] of Object.entries(settings)) {
      await pgPool.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    await syncJSONBackup();
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
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
