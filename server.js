const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const fs = require('fs');

let dbPath = path.join(__dirname, 'a77satta.db');
if (process.env.VERCEL) {
  const tmpDbPath = '/tmp/a77satta.db';
  if (!fs.existsSync(tmpDbPath) && fs.existsSync(dbPath)) {
    try {
      fs.copyFileSync(dbPath, tmpDbPath);
    } catch (e) {
      console.error('Error copying DB to tmp:', e);
    }
  }
  dbPath = tmpDbPath;
}

// Initialize SQLite Database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database at', dbPath);
});

// Seed Initial Data Setup
db.serialize(() => {
  // Admin Table
  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  // Games Table
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    open_time TEXT,
    close_time TEXT,
    yesterday_result TEXT DEFAULT '',
    today_result TEXT DEFAULT 'WAIT',
    table_group INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  )`);

  // Add missing columns if database existed previously
  db.run("ALTER TABLE games ADD COLUMN yesterday_result TEXT DEFAULT ''", () => {});
  db.run("ALTER TABLE games ADD COLUMN today_result TEXT DEFAULT 'WAIT'", () => {});
  db.run("ALTER TABLE games ADD COLUMN table_group INTEGER DEFAULT 1", () => {});
  db.run("ALTER TABLE games ADD COLUMN sort_order INTEGER DEFAULT 0", () => {});

  // Chart Records Table
  db.run(`CREATE TABLE IF NOT EXISTS chart_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date TEXT NOT NULL,
    game_name TEXT NOT NULL,
    result_val TEXT NOT NULL,
    UNIQUE(record_date, game_name)
  )`);

  // Site Settings Table
  db.run(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  // Blogs Table
  db.run(`CREATE TABLE IF NOT EXISTS blogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    image TEXT,
    post_date TEXT,
    tags TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Default Admin User
  db.get("SELECT COUNT(*) as count FROM admin", (err, row) => {
    if (!err && (!row || row.count === 0)) {
      const defaultPassword = bcrypt.hashSync('admin123', 10);
      db.run("INSERT OR IGNORE INTO admin (username, password) VALUES (?, ?)", ['admin', defaultPassword]);
      console.log('Default admin created: admin / admin123');
    }
  });

  // Default Site Settings
  const defaultSettings = [
    ['ticker_text', 'A77satta is an information portal which keep satta king players updated by providing real-time satta king results for gali satta king , faridabad satta and ghaziabad satta.'],
    ['hindi_tagline', 'हा भाई यही आती हे सबसे पहले खबर रूको और देखो'],
    ['main_game_name', 'GALI'],
    ['main_game_result', '97'],
    ['disawer_time', '5:15 AM'],
    ['disawer_prev', '16'],
    ['disawer_wait', 'WAIT'],
    ['telegram_url', 'https://t.me/+Mcnw6vRvig0wNDI1'],
    ['whatsapp_url', 'https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e'],
    ['notice_1', 'SHRI GANESH SATTA KING RESULT IS UPDATED EVERYDAY AT 4:40 PM.'],
    ['notice_2', 'SADAR BAZAR SATTA KING 2026 CHART IS AVAILABLE ON A77SATTA.COM']
  ];

  const stmtSettings = db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)");
  defaultSettings.forEach(s => stmtSettings.run(s));
  stmtSettings.finalize();

  db.run("UPDATE site_settings SET value = 'https://t.me/+Mcnw6vRvig0wNDI1' WHERE key = 'telegram_url'", () => {});
  db.run("UPDATE site_settings SET value = 'https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e' WHERE key = 'whatsapp_url'", () => {});

  // Seed default 28 Games matching main website exactly
  db.run("DELETE FROM games", () => {
    const gamesList = [
      // Table 1 Games (7 Games)
      ['Shri Ganesh', '04:00 AM', '04:00 AM', '45', '15', 1, 1],
      ['Delhi Bazar', '09:00 AM', '09:00 AM', '-', 'WAIT', 1, 2],
      ['Faridabad', '06:00 PM', '06:00 PM', '67', '87', 1, 3],
      ['Ghaziabad', '08:00 PM', '08:00 PM', '-', 'WAIT', 1, 4],
      ['Gali', '11:00 PM', '11:00 PM', '-', 'WAIT', 1, 5],
      ['Desawar', '02:00 AM', '02:00 AM', '-', 'WAIT', 1, 6],
      ['New Game Test', '10:00 AM', '10:00 AM', '-', 'WAIT', 1, 7],

      // Table 2 Games (21 Games)
      ['HR SATTA', '12:15 PM', '12:15 PM', '54', '66', 2, 8],
      ['KKR CITY', '12:30 PM', '12:30 PM', '78', '52', 2, 9],
      ['UJJALA SUPER', '12:30 PM', '12:30 PM', '10', '82', 2, 10],
      ['MADHUPURI', '12:30 PM', '12:30 PM', '29', '01', 2, 11],
      ['KAROL BAGH', '1:45 PM', '1:45 PM', '71', '70', 2, 12],
      ['AMMAN BAZAR', '2:00 PM', '2:00 PM', '17', '01', 2, 13],
      ['SKY KING', '2:00 PM', '2:00 PM', '04', 'WAIT', 2, 14],
      ['DELHI DARBAR', '2:10 PM', '2:10 PM', '13', '92', 2, 15],
      ['NEW GANGA', '3:50 PM', '3:50 PM', '51', '74', 2, 16],
      ['SHRI LAKSHMI', '3:50 PM', '3:50 PM', '51', 'WAIT', 2, 17],
      ['FATEHABAD', '7:00 PM', '7:00 PM', '98', 'WAIT', 2, 18],
      ['RAJ SHREE', '7:20 PM', '7:20 PM', '33', 'WAIT', 2, 19],
      ['UDAIPUR CITY', '7:50 PM', '7:50 PM', '72', 'WAIT', 2, 20],
      ['VIP AGRA', '7:45 PM', '7:45 PM', '81', 'WAIT', 2, 21],
      ['MANDI BAZAR', '8:15 PM', '8:15 PM', '66', 'WAIT', 2, 22],
      ['BHADRA BAZAR', '8:20 PM', '8:20 PM', '00', 'WAIT', 2, 23],
      ['SIALKOT', '8:20 PM', '8:20 PM', '65', 'WAIT', 2, 24],
      ['LION BAZAR', '8:30 PM', '8:30 PM', '56', 'WAIT', 2, 25],
      ['MOHALI-7', '8:40 PM', '8:40 PM', '18', 'WAIT', 2, 26],
      ['DEHRADUN CITY', '9:40 PM', '9:40 PM', '78', 'WAIT', 2, 27],
      ['DAMAN', '9:50 PM', '9:50 PM', '55', 'WAIT', 2, 28]
    ];

    const stmtGames = db.prepare("INSERT INTO games (name, open_time, close_time, yesterday_result, today_result, table_group, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
    gamesList.forEach(g => stmtGames.run(g));
    stmtGames.finalize();
    console.log('Seeded exact 28 Satta Games matching main site');
  });

  // Seed default August 2026 Chart Records if empty
  db.get("SELECT COUNT(*) as count FROM chart_records", (err, row) => {
    if (!err && row && row.count === 0) {
      const initialChartData = [
        ['01-08', 'SADAR BAZAR', '82'], ['01-08', 'GWALIOR', '38'], ['01-08', 'DELHI BAZAR', '71'], ['01-08', 'DELHI MATKA', '21'], ['01-08', 'SHRI GANESH', '26'], ['01-08', 'AGRA', '48'], ['01-08', 'FARIDABAD', '57'], ['01-08', 'ALWAR', '25'], ['01-08', 'GAZIABAD', '23'], ['01-08', 'DWARKA', '48'], ['01-08', 'GALI', '92'], ['01-08', 'DISAWER', '-'],
        ['02-08', 'SADAR BAZAR', '31'], ['02-08', 'GWALIOR', '22'], ['02-08', 'DELHI BAZAR', '09'], ['02-08', 'DELHI MATKA', '16'], ['02-08', 'SHRI GANESH', '58'], ['02-08', 'AGRA', '29'], ['02-08', 'FARIDABAD', '06'], ['02-08', 'ALWAR', '42'], ['02-08', 'GAZIABAD', '15'], ['02-08', 'DWARKA', '76'], ['02-08', 'GALI', '31'], ['02-08', 'DISAWER', '31'],
        ['03-08', 'SADAR BAZAR', '05'], ['03-08', 'GWALIOR', '80'], ['03-08', 'DELHI BAZAR', '53'], ['03-08', 'DELHI MATKA', '56'], ['03-08', 'SHRI GANESH', '31'], ['03-08', 'AGRA', '73'], ['03-08', 'FARIDABAD', '95'], ['03-08', 'ALWAR', '59'], ['03-08', 'GAZIABAD', '60'], ['03-08', 'DWARKA', '79'], ['03-08', 'GALI', '59'], ['03-08', 'DISAWER', '74'],
        ['04-08', 'SADAR BAZAR', '99'], ['04-08', 'GWALIOR', '01'], ['04-08', 'DELHI BAZAR', '12'], ['04-08', 'DELHI MATKA', '67'], ['04-08', 'SHRI GANESH', '10'], ['04-08', 'AGRA', '78'], ['04-08', 'FARIDABAD', '12'], ['04-08', 'ALWAR', '34'], ['04-08', 'GAZIABAD', '24'], ['04-08', 'DWARKA', '15'], ['04-08', 'GALI', '27'], ['04-08', 'DISAWER', '31'],
        ['05-08', 'SADAR BAZAR', '24'], ['05-08', 'GWALIOR', '60'], ['05-08', 'DELHI BAZAR', '47'], ['05-08', 'DELHI MATKA', '19'], ['05-08', 'SHRI GANESH', '75'], ['05-08', 'AGRA', '76'], ['05-08', 'FARIDABAD', '57'], ['05-08', 'ALWAR', '56'], ['05-08', 'GAZIABAD', '22'], ['05-08', 'DWARKA', '01'], ['05-08', 'GALI', '85'], ['05-08', 'DISAWER', '93'],
        ['06-08', 'SADAR BAZAR', '95'], ['06-08', 'GWALIOR', '21'], ['06-08', 'DELHI BAZAR', '61'], ['06-08', 'DELHI MATKA', '16'], ['06-08', 'SHRI GANESH', '97'], ['06-08', 'AGRA', '48'], ['06-08', 'FARIDABAD', '22'], ['06-08', 'ALWAR', '24'], ['06-08', 'GAZIABAD', '89'], ['06-08', 'DWARKA', '79'], ['06-08', 'GALI', '80'], ['06-08', 'DISAWER', '51'],
        ['07-08', 'SADAR BAZAR', '48'], ['07-08', 'GWALIOR', '15'], ['07-08', 'DELHI BAZAR', '52'], ['07-08', 'DELHI MATKA', '27'], ['07-08', 'SHRI GANESH', '80'], ['07-08', 'AGRA', '02'], ['07-08', 'FARIDABAD', '26'], ['07-08', 'ALWAR', '09'], ['07-08', 'GAZIABAD', '60'], ['07-08', 'DWARKA', '58'], ['07-08', 'GALI', '35'], ['07-08', 'DISAWER', '83'],
        ['08-08', 'SADAR BAZAR', '30'], ['08-08', 'GWALIOR', '47'], ['08-08', 'DELHI BAZAR', '91'], ['08-08', 'DELHI MATKA', '45'], ['08-08', 'SHRI GANESH', '93'], ['08-08', 'AGRA', '18'], ['08-08', 'FARIDABAD', '81'], ['08-08', 'ALWAR', '20'], ['08-08', 'GAZIABAD', '99'], ['08-08', 'DWARKA', '10'], ['08-08', 'GALI', '93'], ['08-08', 'DISAWER', '96'],
        ['09-08', 'SADAR BAZAR', '35'], ['09-08', 'GWALIOR', '87'], ['09-08', 'DELHI BAZAR', '89'], ['09-08', 'DELHI MATKA', '07'], ['09-08', 'SHRI GANESH', '74'], ['09-08', 'AGRA', '39'], ['09-08', 'FARIDABAD', '63'], ['09-08', 'ALWAR', '82'], ['09-08', 'GAZIABAD', '53'], ['09-08', 'DWARKA', '95'], ['09-08', 'GALI', '97'], ['09-08', 'DISAWER', '16']
      ];

      const stmtChart = db.prepare("INSERT OR REPLACE INTO chart_records (record_date, game_name, result_val) VALUES (?, ?, ?)");
      initialChartData.forEach(c => stmtChart.run(c));
      stmtChart.finalize();
      console.log('Seeded August 2026 Chart Records');
    }
  });

  // Seed default Blog Posts if empty
  db.get("SELECT COUNT(*) as count FROM blogs", (err, row) => {
    if (!err && row && row.count === 0) {
      const blogsList = [
        [
          'WHY IS THE DELHI BAZAR SATTA KING SO POPULAR ?',
          'why-is-the-delhi-bazar-satta-king-so-popular',
          'https://a77satta.com/_next/image?url=https%3A%2F%2Fcdn.satta-king7.in%2Fimages%2F1785146554021-rp3k2kxz3h2xpob-delhi-bazar-satta-king-1.jpg&w=1080&q=75',
          'Posted on Jul 27',
          '#delhibazarsattaking #delhibazarsatta #sattaking #delhibajarsattaking',
          'Delhi Bazar Satta King has become one of the most famous games in the Satta King market...'
        ],
        [
          'what is shri ganesh satta king ?',
          'what-is-shri-ganesh-satta-king',
          'https://a77satta.com/_next/image?url=https%3A%2F%2Fcdn.satta-king7.in%2Fimages%2F1785856182655-bj5ycn3ifhogxkq-shri-ganesh-satta-king.jpg&w=1080&q=75',
          'Posted on May 9',
          '#shriganeshsattaking #playbajar #playbazaar #sattaking',
          'Shri Ganesh Satta King is widely followed for its timely 4:40 PM result declaration everyday...'
        ]
      ];

      const stmtBlog = db.prepare("INSERT INTO blogs (title, slug, image, post_date, tags, content) VALUES (?, ?, ?, ?, ?, ?)");
      blogsList.forEach(b => stmtBlog.run(b));
      stmtBlog.finalize();
      console.log('Seeded default blog posts');
    }
  });
});

// ========================================
// REST API ROUTES
// ========================================

// Public: Get all site data for homepage & chart page
app.get('/api/site-data', (req, res) => {
  const data = {};

  db.all("SELECT key, value FROM site_settings", [], (err, settings) => {
    if (err) return res.status(500).json({ error: err.message });
    data.settings = {};
    (settings || []).forEach(s => data.settings[s.key] = s.value);

    db.all("SELECT * FROM games ORDER BY id ASC", [], (err, games) => {
      if (err) return res.status(500).json({ error: err.message });
      data.games = games || [];

      db.all("SELECT * FROM chart_records ORDER BY record_date ASC", [], (err, charts) => {
        if (err) return res.status(500).json({ error: err.message });
        data.chart_records = charts || [];

        db.all("SELECT * FROM blogs ORDER BY id DESC", [], (err, blogs) => {
          if (err) return res.status(500).json({ error: err.message });
          data.blogs = blogs || [];
          res.json(data);
        });
      });
    });
  });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM admin WHERE username = ?", [username], (err, row) => {
    if (err || !row) return res.status(401).json({ error: 'Invalid username or password' });
    if (bcrypt.compareSync(password, row.password)) {
      res.json({ success: true, token: 'admin-logged-in-session-token' });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  });
});

// Admin: Update Game Result (Today / Yesterday)
app.post('/api/admin/update-game', (req, res) => {
  const { id, name, open_time, yesterday_result, today_result } = req.body;
  const sql = "UPDATE games SET name = ?, yesterday_result = ?, today_result = ?, open_time = ? WHERE id = ?";
  db.run(sql, [name, yesterday_result, today_result, open_time, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // AUTOMATIC SYNC TO CHART RECORDS TABLE FOR TODAY'S DATE
    if (today_result && today_result.trim() !== '' && today_result !== 'WAIT') {
      const todayDateStr = '09-08';
      db.run("INSERT OR REPLACE INTO chart_records (record_date, game_name, result_val) VALUES (?, ?, ?)", [todayDateStr, name, today_result.trim()]);
    }
    
    res.json({ success: true, message: 'Game updated successfully' });
  });
});

// Admin: Add New Game
app.post('/api/admin/add-game', (req, res) => {
  const { name, open_time, yesterday_result, today_result, table_group } = req.body;
  const sql = "INSERT INTO games (name, open_time, close_time, yesterday_result, today_result, table_group, sort_order) VALUES (?, ?, ?, ?, ?, ?, 99)";
  db.run(sql, [name, open_time, open_time, yesterday_result || '', today_result || 'WAIT', table_group || 1], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

// Admin: Delete Game
app.post('/api/admin/delete-game', (req, res) => {
  const { id } = req.body;
  db.run("DELETE FROM games WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Admin: Save/Update Chart Cell
app.post('/api/admin/update-chart-cell', (req, res) => {
  const { record_date, game_name, result_val } = req.body;
  const sql = "INSERT OR REPLACE INTO chart_records (record_date, game_name, result_val) VALUES (?, ?, ?)";
  db.run(sql, [record_date, game_name, result_val], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Admin: Save Settings (Ticker, Hindi tagline, Links, etc.)
app.post('/api/admin/update-settings', (req, res) => {
  const settings = req.body; // Key-Value object
  const stmt = db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(settings)) {
    stmt.run([key, value]);
  }
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Settings saved successfully' });
  });
});

// Admin: Save/Update Blog Post
app.post('/api/admin/save-blog', (req, res) => {
  const { id, title, slug, image, post_date, tags, content } = req.body;
  if (id) {
    const sql = "UPDATE blogs SET title=?, slug=?, image=?, post_date=?, tags=?, content=? WHERE id=?";
    db.run(sql, [title, slug, image, post_date, tags, content, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  } else {
    const sql = "INSERT INTO blogs (title, slug, image, post_date, tags, content) VALUES (?, ?, ?, ?, ?, ?)";
    db.run(sql, [title, slug, image, post_date, tags, content], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
  }
});

// Admin: Delete Blog Post
app.post('/api/admin/delete-blog', (req, res) => {
  const { id } = req.body;
  db.run("DELETE FROM blogs WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Admin: Change Password
app.post('/api/admin/change-password', (req, res) => {
  const { new_password } = req.body;
  const hash = bcrypt.hashSync(new_password, 10);
  db.run("UPDATE admin SET password = ? WHERE username = 'admin'", [hash], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Password updated successfully' });
  });
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
    console.log(`Default admin: admin / admin123`);
  });
}

module.exports = app;
