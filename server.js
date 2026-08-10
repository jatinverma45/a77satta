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
const { Client: PgClient } = require('pg');
const SUPABASE_DB_URI = process.env.SUPABASE_DB_URI || 'postgresql://postgres:SattaaA77king@db.sszqmfagodieabgsbzev.supabase.co:5432/postgres';

async function pushToSupabase(fullData) {
  try {
    const client = new PgClient({ connectionString: SUPABASE_DB_URI, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const jsonStr = JSON.stringify(fullData);
    await client.query('INSERT INTO site_store (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', ['full_site_backup', jsonStr]);
    await client.end();
    console.log('✅ Synced data to Supabase Cloud PostgreSQL!');
  } catch (e) {
    console.error('Error syncing to Supabase Cloud DB:', e.message);
  }
}

async function fetchFromSupabase() {
  try {
    const client = new PgClient({ connectionString: SUPABASE_DB_URI, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const res = await client.query('SELECT value FROM site_store WHERE key = $1', ['full_site_backup']);
    await client.end();
    if (res.rows && res.rows.length > 0 && res.rows[0].value) {
      return JSON.parse(res.rows[0].value);
    }
  } catch (e) {
    console.error('Error fetching from Supabase Cloud DB:', e.message);
  }
  return null;
}

let dbPath = path.join(__dirname, 'a77satta.db');
if (process.env.VERCEL) {
  const tmpDbPath = '/tmp/a77satta.db';
  const tmpBackupPath = '/tmp/data_backup.json';
  const bundledBackupPath = path.join(__dirname, 'data_backup.json');

  try {
    // Only copy initial DB / backup IF /tmp/a77satta.db does NOT exist yet
    if (!fs.existsSync(tmpDbPath) && fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, tmpDbPath);
    }
    if (!fs.existsSync(tmpBackupPath) && fs.existsSync(bundledBackupPath)) {
      fs.copyFileSync(bundledBackupPath, tmpBackupPath);
    }
  } catch (e) {
    console.error('Error initializing tmp database:', e);
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
  db.run("ALTER TABLE games ADD COLUMN is_hero INTEGER DEFAULT 0", () => {
    db.run("UPDATE games SET is_hero = 1 WHERE UPPER(name) IN ('RAJ SHREE', 'UDAIPUR CITY')");
  });

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

  // Admin User Credentials (A77SattaOfficial / SattaA77@77)
  db.get("SELECT COUNT(*) as count FROM admin", (err, row) => {
    if (err || !row || row.count === 0) {
      const adminPassword = bcrypt.hashSync('SattaA77@77', 10);
      db.run("INSERT INTO admin (username, password) VALUES (?, ?)", ['A77SattaOfficial', adminPassword]);
      console.log('Admin credentials initialized: A77SattaOfficial / SattaA77@77');
    }
  });

  // Default Site Settings
  const defaultNoticeBanners = JSON.stringify([
    { id: 1, text: "SHRI GANESH SATTA KING RESULT IS UPDATED EVERYDAY AT 4:40 PM." },
    { id: 2, text: "SADAR BAZAR SATTA KING 2026 CHART IS AVAILABLE ON A77SATTA.COM" }
  ]);

  const defaultKhaiwalCards = JSON.stringify([
    {
      id: 1,
      header_subtitle: "--सीधी सट्टा कंपनी का No 1 शर्तावाल--",
      title: "♣ KUBER BHAI KHAIWAL ♣",
      card_type: "standard",
      times_text: "सट्टे बाजार ----------- 1:30 pm\nघाटियाल ----------- 2:30 pm\nदिल्ली बाजार ----------- 2:50 pm\nदिल्ली मटका ----------- 3:20 PM\nश्री गणेश ----------- 4:20 pm\nआगारा ----------- 5:20 pm\nफरीदाबाद ----------- 5:50 pm\nअलवर ----------- 7:20 pm\nगाजियाबाद ----------- 8:50 pm\nझारखा ----------- 10:10 pm\nगली ----------- 11:20 pm\nडिसावर ----------- 1:30 AM",
      footer_text: "Game play करने के लिए नीचे लिंक पर क्लिक करें",
      whatsapp_url: "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e"
    },
    {
      id: 2,
      header_subtitle: "--सीधी सट्टा कम्पनी का No 1 शर्तावाल--",
      title: "♣ JASSI BHAI KHAIWAL ♣",
      card_type: "standard",
      times_text: "सट्टे बाजार ----------- 1:30 pm\nघाटियाल ----------- 2:30 pm\nदिल्ली बाजार ----------- 2:50 pm\nदिल्ली मटका ----------- 3:20 PM\nश्री गणेश ----------- 4:20 pm\nआगारा ----------- 5:20 pm\nफरीदाबाद ----------- 5:50 pm\nअलवर ----------- 7:20 pm\nगाजियाबाद ----------- 8:50 pm\nझारखा ----------- 10:10 pm\nगली ----------- 11:20 pm\nडिसावर ----------- 1:30 AM",
      footer_text: "Game play करने के लिए नीचे लिंक पर क्लिक करें",
      whatsapp_url: "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e"
    },
    {
      id: 3,
      header_subtitle: "",
      title: "नमस्कार सपयानी Cricket ID दोनों वाले भाई नीचे दिए गए लिंक पर क्लिक करें",
      card_type: "feature",
      times_text: "minimum ID 500₹ maximum no limit\n*** *** *** *** *** *** *** ***\nNote इस नंबर पर पैसे क्लिक करने वाले जो भी गलत होगा फिर\nफॉल्ट के लिए payment के लिए money transfer की जगह अन्य जगह हो सकता है",
      footer_text: "",
      whatsapp_url: "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e"
    },
    {
      id: 4,
      header_subtitle: "--सीधी सट्टा कंपनी का No 1 शर्तावाल--",
      title: "♣ RAMAN BHAI KHAIWAL ♣",
      card_type: "standard",
      times_text: "सट्टे बाजार ----------- 1:30 pm\nघाटियाल ----------- 2:30 pm\nदिल्ली बाजार ----------- 2:50 pm\nदिल्ली मटका ----------- 3:20 PM\nश्री गणेश ----------- 4:20 pm\nआगारा ----------- 5:20 pm\nफरीदाबाद ----------- 5:50 pm\nअलवर ----------- 7:20 pm\nगाजियाबाद ----------- 8:50 pm\nझारखा ----------- 10:10 pm\nगली ----------- 11:20 pm\nडिसावर ----------- 1:30 AM",
      footer_text: "Game play करने के लिए नीचे लिंक पर क्लिक करें",
      whatsapp_url: "https://whatsapp.com/channel/0029Vb8fAasLSmbdQvgy8f0e"
    }
  ]);

  const defaultSettings = [
    ['ticker_text', 'A77satta is an information portal which keep satta king players updated by providing real-time satta king results for gali satta king , faridabad satta and ghaziabad satta.'],
    ['hindi_tagline', 'हा भाई यही आती हे सबसे पहले खबर रूको और देखो'],
    ['hero_games_json', '[{"name":"RAJ SHREE","today_result":"WAIT"},{"name":"UDAIPUR CITY","today_result":"WAIT"}]'],
    ['notice_banners_json', defaultNoticeBanners],
    ['khaiwal_cards_json', defaultKhaiwalCards],
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

  // Supabase Cloud Restoration Engine
  fetchFromSupabase().then(supaBackup => {
    const backup = supaBackup || (function() {
      const bPath = getBackupFileToRead();
      if (bPath) {
        try { return JSON.parse(fs.readFileSync(bPath, 'utf8')); } catch(e){}
      }
      return null;
    })();

    if (backup) {
      if (backup.games && backup.games.length > 0) {
        db.run("DELETE FROM games", () => {
          const stmtGames = db.prepare("INSERT INTO games (id, name, open_time, close_time, yesterday_result, today_result, table_group, sort_order, is_hero) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
          backup.games.forEach(g => {
            stmtGames.run([g.id || null, g.name, g.open_time || '', g.close_time || '', g.yesterday_result || '', g.today_result || 'WAIT', g.table_group || 1, g.sort_order || 0, g.is_hero || 0]);
          });
          stmtGames.finalize();
          console.log('✅ Synchronized games from Supabase Cloud DB:', backup.games.length);
        });
      }
      if (backup.chart_records && backup.chart_records.length > 0) {
        db.run("DELETE FROM chart_records", () => {
          const stmtChart = db.prepare("INSERT OR REPLACE INTO chart_records (record_date, game_name, result_val) VALUES (?, ?, ?)");
          backup.chart_records.forEach(c => {
            if (c && c.record_date && c.game_name) {
              stmtChart.run([c.record_date.trim(), c.game_name.trim().toUpperCase(), c.result_val || '-']);
            }
          });
          stmtChart.finalize();
          console.log('✅ Synchronized chart records from Supabase Cloud DB:', backup.chart_records.length);
        });
      }
      if (backup.settings) {
        const stmtSettings = db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)");
        Object.keys(backup.settings).forEach(k => {
          stmtSettings.run([k, backup.settings[k]]);
        });
        stmtSettings.finalize();
        console.log('✅ Synchronized site settings from Supabase Cloud DB');
      }
    }
  });

  // Preserve Games: Only seed if database table is completely empty
  db.get("SELECT COUNT(*) as count FROM games", (err, row) => {
    if (err || !row || row.count === 0) {
      let loadedFromBackup = false;
      const bPath = getBackupFileToRead();
      if (bPath) {
        try {
          const backup = JSON.parse(fs.readFileSync(bPath, 'utf8'));
          if (backup && backup.games && backup.games.length > 0) {
            const stmtGames = db.prepare("INSERT INTO games (id, name, open_time, close_time, yesterday_result, today_result, table_group, sort_order, is_hero) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            backup.games.forEach(g => {
              stmtGames.run([g.id || null, g.name, g.open_time || '', g.close_time || '', g.yesterday_result || '', g.today_result || 'WAIT', g.table_group || 1, g.sort_order || 0, g.is_hero || 0]);
            });
            stmtGames.finalize();
            loadedFromBackup = true;
            console.log('Restored games from backup JSON:', backup.games.length);
          }
        } catch(e) {
          console.error('Error restoring games from backup:', e);
        }
      }

      if (!loadedFromBackup) {
        const gamesList = [
          // Table 1 Games (7 Games)
          ['Shri Ganesh', '04:00 AM', '04:00 AM', '45', '15', 1, 1],
          ['Delhi Bazar', '09:00 AM', '09:00 AM', '-', 'WAIT', 1, 2],
          ['Faridabad', '06:00 PM', '06:00 PM', '67', '87', 1, 3],
          ['Ghaziabad', '08:00 PM', '08:00 PM', '-', 'WAIT', 1, 4],
          ['Gali', '11:00 PM', '11:00 PM', '-', 'WAIT', 1, 5],
          ['Desawar', '02:00 AM', '02:00 AM', '-', 'WAIT', 1, 6],

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
        console.log('Seeded default 28 Satta Games');
      }
    } else {
      console.log(`Existing ${row.count} games preserved in database.`);
    }
  });

  // Preserve Chart Records: Only seed if database table is completely empty
  db.get("SELECT COUNT(*) as count FROM chart_records", (err, row) => {
    if (err || !row || row.count === 0) {
      let loadedFromBackup = false;
      const bPath = getBackupFileToRead();
      if (bPath) {
        try {
          const backup = JSON.parse(fs.readFileSync(bPath, 'utf8'));
          if (backup && backup.chart_records && backup.chart_records.length > 0) {
            const stmtChart = db.prepare("INSERT OR REPLACE INTO chart_records (record_date, game_name, result_val) VALUES (?, ?, ?)");
            backup.chart_records.forEach(c => {
              if (c && c.record_date && c.game_name) {
                stmtChart.run([c.record_date.trim(), c.game_name.trim().toUpperCase(), c.result_val || '-']);
              }
            });
            stmtChart.finalize();
            loadedFromBackup = true;
            console.log('Restored chart_records from backup JSON:', backup.chart_records.length);
          }
        } catch(e) {
          console.error('Error restoring chart_records from backup:', e);
        }
      }

      if (!loadedFromBackup) {
        const initialChartData = [
          // Table 1 (01-08 to 10-08)
          ['01-08', 'SADAR BAZAR', '82'], ['01-08', 'GWALIOR', '38'], ['01-08', 'DELHI BAZAR', '71'], ['01-08', 'DELHI MATKA', '21'], ['01-08', 'SHRI GANESH', '26'], ['01-08', 'AGRA', '48'], ['01-08', 'FARIDABAD', '57'], ['01-08', 'ALWAR', '25'], ['01-08', 'GAZIABAD', '23'], ['01-08', 'DWARKA', '48'], ['01-08', 'GALI', '92'], ['01-08', 'DISAWER', '-'],
          ['02-08', 'SADAR BAZAR', '31'], ['02-08', 'GWALIOR', '22'], ['02-08', 'DELHI BAZAR', '09'], ['02-08', 'DELHI MATKA', '16'], ['02-08', 'SHRI GANESH', '58'], ['02-08', 'AGRA', '29'], ['02-08', 'FARIDABAD', '06'], ['02-08', 'ALWAR', '42'], ['02-08', 'GAZIABAD', '15'], ['02-08', 'DWARKA', '76'], ['02-08', 'GALI', '31'], ['02-08', 'DISAWER', '31'],
          ['03-08', 'SADAR BAZAR', '05'], ['03-08', 'GWALIOR', '80'], ['03-08', 'DELHI BAZAR', '53'], ['03-08', 'DELHI MATKA', '56'], ['03-08', 'SHRI GANESH', '31'], ['03-08', 'AGRA', '73'], ['03-08', 'FARIDABAD', '95'], ['03-08', 'ALWAR', '59'], ['03-08', 'GAZIABAD', '60'], ['03-08', 'DWARKA', '79'], ['03-08', 'GALI', '59'], ['03-08', 'DISAWER', '74'],
          ['04-08', 'SADAR BAZAR', '99'], ['04-08', 'GWALIOR', '01'], ['04-08', 'DELHI BAZAR', '12'], ['04-08', 'DELHI MATKA', '67'], ['04-08', 'SHRI GANESH', '10'], ['04-08', 'AGRA', '78'], ['04-08', 'FARIDABAD', '12'], ['04-08', 'ALWAR', '34'], ['04-08', 'GAZIABAD', '24'], ['04-08', 'DWARKA', '15'], ['04-08', 'GALI', '27'], ['04-08', 'DISAWER', '31'],
          ['05-08', 'SADAR BAZAR', '24'], ['05-08', 'GWALIOR', '60'], ['05-08', 'DELHI BAZAR', '47'], ['05-08', 'DELHI MATKA', '19'], ['05-08', 'SHRI GANESH', '75'], ['05-08', 'AGRA', '76'], ['05-08', 'FARIDABAD', '57'], ['05-08', 'ALWAR', '56'], ['05-08', 'GAZIABAD', '22'], ['05-08', 'DWARKA', '01'], ['05-08', 'GALI', '85'], ['05-08', 'DISAWER', '93'],
          ['06-08', 'SADAR BAZAR', '95'], ['06-08', 'GWALIOR', '21'], ['06-08', 'DELHI BAZAR', '61'], ['06-08', 'DELHI MATKA', '16'], ['06-08', 'SHRI GANESH', '97'], ['06-08', 'AGRA', '48'], ['06-08', 'FARIDABAD', '22'], ['06-08', 'ALWAR', '24'], ['06-08', 'GAZIABAD', '89'], ['06-08', 'DWARKA', '79'], ['06-08', 'GALI', '80'], ['06-08', 'DISAWER', '51'],
          ['07-08', 'SADAR BAZAR', '48'], ['07-08', 'GWALIOR', '15'], ['07-08', 'DELHI BAZAR', '52'], ['07-08', 'DELHI MATKA', '27'], ['07-08', 'SHRI GANESH', '80'], ['07-08', 'AGRA', '02'], ['07-08', 'FARIDABAD', '26'], ['07-08', 'ALWAR', '09'], ['07-08', 'GAZIABAD', '60'], ['07-08', 'DWARKA', '58'], ['07-08', 'GALI', '35'], ['07-08', 'DISAWER', '83'],
          ['08-08', 'SADAR BAZAR', '30'], ['08-08', 'GWALIOR', '47'], ['08-08', 'DELHI BAZAR', '91'], ['08-08', 'DELHI MATKA', '45'], ['08-08', 'SHRI GANESH', '93'], ['08-08', 'AGRA', '18'], ['08-08', 'FARIDABAD', '81'], ['08-08', 'ALWAR', '20'], ['08-08', 'GAZIABAD', '99'], ['08-08', 'DWARKA', '10'], ['08-08', 'GALI', '93'], ['08-08', 'DISAWER', '96'],
          ['09-08', 'SADAR BAZAR', '35'], ['09-08', 'GWALIOR', '87'], ['09-08', 'DELHI BAZAR', '89'], ['09-08', 'DELHI MATKA', '07'], ['09-08', 'SHRI GANESH', '74'], ['09-08', 'AGRA', '39'], ['09-08', 'FARIDABAD', '63'], ['09-08', 'ALWAR', '82'], ['09-08', 'GAZIABAD', '53'], ['09-08', 'DWARKA', '95'], ['09-08', 'GALI', '97'], ['09-08', 'DISAWER', '16'],
          ['10-08', 'SADAR BAZAR', '48'], ['10-08', 'GWALIOR', '61'], ['10-08', 'DELHI BAZAR', '85'], ['10-08', 'DELHI MATKA', '59'], ['10-08', 'SHRI GANESH', '64'], ['10-08', 'AGRA', '28'], ['10-08', 'FARIDABAD', '58'], ['10-08', 'ALWAR', '-'], ['10-08', 'GAZIABAD', '-'], ['10-08', 'DWARKA', '-'], ['10-08', 'GALI', '-'], ['10-08', 'DISAWER', '64'],

          // Table 2 (01-08 to 10-08)
          ['01-08', 'HR SATTA', '31'], ['01-08', 'UJJALA SUPER', '15'], ['01-08', 'KKR CITY', '03'], ['01-08', 'MADHUPURI', '61'], ['01-08', 'ANMOL BAZAR', '12'], ['01-08', 'KAROL BAGH', '19'], ['01-08', 'AMMAN BAZAR', '-'], ['01-08', 'DELHI DARBAR', '61'], ['01-08', 'NEW GANGA', '05'], ['01-08', 'SKY KING', '61'], ['01-08', 'FATEHABAD', '75'], ['01-08', 'UDAIPUR CITY', '24'], ['01-08', 'RAJ SHREE', '95'], ['01-08', 'VIP AGRA', '15'], ['01-08', 'MOHALI-7', '21'], ['01-08', 'BHADRA BAZAR', '02'], ['01-08', 'MANDI BAZAR', '57'], ['01-08', 'LION BAZAR', '19'], ['01-08', 'SIALKOT', '13'], ['01-08', 'DEHRADUN CITY', '27'], ['01-08', 'DAMAN', '55'],

          ['02-08', 'HR SATTA', '87'], ['02-08', 'UJJALA SUPER', '77'], ['02-08', 'KKR CITY', '01'], ['02-08', 'MADHUPURI', '89'], ['02-08', 'ANMOL BAZAR', '13'], ['02-08', 'KAROL BAGH', '29'], ['02-08', 'AMMAN BAZAR', '-'], ['02-08', 'DELHI DARBAR', '36'], ['02-08', 'NEW GANGA', '96'], ['02-08', 'SKY KING', '06'], ['02-08', 'FATEHABAD', '08'], ['02-08', 'UDAIPUR CITY', '22'], ['02-08', 'RAJ SHREE', '91'], ['02-08', 'VIP AGRA', '00'], ['02-08', 'MOHALI-7', '33'], ['02-08', 'BHADRA BAZAR', '05'], ['02-08', 'MANDI BAZAR', '22'], ['02-08', 'LION BAZAR', '06'], ['02-08', 'SIALKOT', '56'], ['02-08', 'DEHRADUN CITY', '93'], ['02-08', 'DAMAN', '16'],

          ['03-08', 'HR SATTA', '71'], ['03-08', 'UJJALA SUPER', '12'], ['03-08', 'KKR CITY', '69'], ['03-08', 'MADHUPURI', '00'], ['03-08', 'ANMOL BAZAR', '76'], ['03-08', 'KAROL BAGH', '59'], ['03-08', 'AMMAN BAZAR', '-'], ['03-08', 'DELHI DARBAR', '57'], ['03-08', 'NEW GANGA', '08'], ['03-08', 'SKY KING', '06'], ['03-08', 'FATEHABAD', '08'], ['03-08', 'UDAIPUR CITY', '99'], ['03-08', 'RAJ SHREE', '93'], ['03-08', 'VIP AGRA', '70'], ['03-08', 'MOHALI-7', '15'], ['03-08', 'BHADRA BAZAR', '71'], ['03-08', 'MANDI BAZAR', '50'], ['03-08', 'LION BAZAR', '58'], ['03-08', 'SIALKOT', '75'], ['03-08', 'DEHRADUN CITY', '60'], ['03-08', 'DAMAN', '10'],

          ['04-08', 'HR SATTA', '93'], ['04-08', 'UJJALA SUPER', '18'], ['04-08', 'KKR CITY', '88'], ['04-08', 'MADHUPURI', '05'], ['04-08', 'ANMOL BAZAR', '42'], ['04-08', 'KAROL BAGH', '20'], ['04-08', 'AMMAN BAZAR', '-'], ['04-08', 'DELHI DARBAR', '74'], ['04-08', 'NEW GANGA', '94'], ['04-08', 'SKY KING', '24'], ['04-08', 'FATEHABAD', '52'], ['04-08', 'UDAIPUR CITY', '13'], ['04-08', 'RAJ SHREE', '71'], ['04-08', 'VIP AGRA', '11'], ['04-08', 'MOHALI-7', '14'], ['04-08', 'BHADRA BAZAR', '66'], ['04-08', 'MANDI BAZAR', '69'], ['04-08', 'LION BAZAR', '68'], ['04-08', 'SIALKOT', '47'], ['04-08', 'DEHRADUN CITY', '57'], ['04-08', 'DAMAN', '21'],

          ['05-08', 'HR SATTA', '73'], ['05-08', 'UJJALA SUPER', '92'], ['05-08', 'KKR CITY', '33'], ['05-08', 'MADHUPURI', '45'], ['05-08', 'ANMOL BAZAR', '39'], ['05-08', 'KAROL BAGH', '64'], ['05-08', 'AMMAN BAZAR', '-'], ['05-08', 'DELHI DARBAR', '78'], ['05-08', 'NEW GANGA', '64'], ['05-08', 'SKY KING', '93'], ['05-08', 'FATEHABAD', '75'], ['05-08', 'UDAIPUR CITY', '40'], ['05-08', 'RAJ SHREE', '55'], ['05-08', 'VIP AGRA', '73'], ['05-08', 'MOHALI-7', '98'], ['05-08', 'BHADRA BAZAR', '53'], ['05-08', 'MANDI BAZAR', '84'], ['05-08', 'LION BAZAR', '45'], ['05-08', 'SIALKOT', '99'], ['05-08', 'DEHRADUN CITY', '05'], ['05-08', 'DAMAN', '13'],

          ['06-08', 'HR SATTA', '60'], ['06-08', 'UJJALA SUPER', '31'], ['06-08', 'KKR CITY', '03'], ['06-08', 'MADHUPURI', '71'], ['06-08', 'ANMOL BAZAR', '84'], ['06-08', 'KAROL BAGH', '25'], ['06-08', 'AMMAN BAZAR', '-'], ['06-08', 'DELHI DARBAR', '18'], ['06-08', 'NEW GANGA', '18'], ['06-08', 'SKY KING', '93'], ['06-08', 'FATEHABAD', '55'], ['06-08', 'UDAIPUR CITY', '45'], ['06-08', 'RAJ SHREE', '78'], ['06-08', 'VIP AGRA', '02'], ['06-08', 'MOHALI-7', '65'], ['06-08', 'BHADRA BAZAR', '43'], ['06-08', 'MANDI BAZAR', '44'], ['06-08', 'LION BAZAR', '19'], ['06-08', 'SIALKOT', '17'], ['06-08', 'DEHRADUN CITY', '23'], ['06-08', 'DAMAN', '93'],

          ['07-08', 'HR SATTA', '59'], ['07-08', 'UJJALA SUPER', '45'], ['07-08', 'KKR CITY', '86'], ['07-08', 'MADHUPURI', '21'], ['07-08', 'ANMOL BAZAR', '67'], ['07-08', 'KAROL BAGH', '99'], ['07-08', 'AMMAN BAZAR', '-'], ['07-08', 'DELHI DARBAR', '69'], ['07-08', 'NEW GANGA', '54'], ['07-08', 'SKY KING', '48'], ['07-08', 'FATEHABAD', '43'], ['07-08', 'UDAIPUR CITY', '00'], ['07-08', 'RAJ SHREE', '13'], ['07-08', 'VIP AGRA', '42'], ['07-08', 'MOHALI-7', '00'], ['07-08', 'BHADRA BAZAR', '19'], ['07-08', 'MANDI BAZAR', '47'], ['07-08', 'LION BAZAR', '05'], ['07-08', 'SIALKOT', '06'], ['07-08', 'DEHRADUN CITY', '64'], ['07-08', 'DAMAN', '63'],

          ['08-08', 'HR SATTA', '54'], ['08-08', 'UJJALA SUPER', '10'], ['08-08', 'KKR CITY', '78'], ['08-08', 'MADHUPURI', '29'], ['08-08', 'ANMOL BAZAR', '17'], ['08-08', 'KAROL BAGH', '71'], ['08-08', 'AMMAN BAZAR', '-'], ['08-08', 'DELHI DARBAR', '13'], ['08-08', 'NEW GANGA', '51'], ['08-08', 'SKY KING', '04'], ['08-08', 'FATEHABAD', '98'], ['08-08', 'UDAIPUR CITY', '72'], ['08-08', 'RAJ SHREE', '33'], ['08-08', 'VIP AGRA', '81'], ['08-08', 'MOHALI-7', '18'], ['08-08', 'BHADRA BAZAR', '00'], ['08-08', 'MANDI BAZAR', '66'], ['08-08', 'LION BAZAR', '56'], ['08-08', 'SIALKOT', '65'], ['08-08', 'DEHRADUN CITY', '78'], ['08-08', 'DAMAN', '55'],

          ['09-08', 'HR SATTA', '66'], ['09-08', 'UJJALA SUPER', '82'], ['09-08', 'KKR CITY', '52'], ['09-08', 'MADHUPURI', '01'], ['09-08', 'ANMOL BAZAR', '01'], ['09-08', 'KAROL BAGH', '70'], ['09-08', 'AMMAN BAZAR', '-'], ['09-08', 'DELHI DARBAR', '92'], ['09-08', 'NEW GANGA', '74'], ['09-08', 'SKY KING', '08'], ['09-08', 'FATEHABAD', '-'], ['09-08', 'UDAIPUR CITY', '79'], ['09-08', 'RAJ SHREE', '78'], ['09-08', 'VIP AGRA', '63'], ['09-08', 'MOHALI-7', '22'], ['09-08', 'BHADRA BAZAR', '17'], ['09-08', 'MANDI BAZAR', '74'], ['09-08', 'LION BAZAR', '77'], ['09-08', 'SIALKOT', '03'], ['09-08', 'DEHRADUN CITY', '18'], ['09-08', 'DAMAN', '43'],

          ['10-08', 'HR SATTA', '80'], ['10-08', 'UJJALA SUPER', '81'], ['10-08', 'KKR CITY', '30'], ['10-08', 'MADHUPURI', '36'], ['10-08', 'ANMOL BAZAR', '61'], ['10-08', 'KAROL BAGH', '69'], ['10-08', 'AMMAN BAZAR', '-'], ['10-08', 'DELHI DARBAR', '73'], ['10-08', 'NEW GANGA', '24'], ['10-08', 'SKY KING', '53'], ['10-08', 'FATEHABAD', '84'], ['10-08', 'UDAIPUR CITY', '-'], ['10-08', 'RAJ SHREE', '-'], ['10-08', 'VIP AGRA', '-'], ['10-08', 'MOHALI-7', '-'], ['10-08', 'BHADRA BAZAR', '-'], ['10-08', 'MANDI BAZAR', '-'], ['10-08', 'LION BAZAR', '-'], ['10-08', 'SIALKOT', '-'], ['10-08', 'DEHRADUN CITY', '-'], ['10-08', 'DAMAN', '-']
        ];

        const stmtChart = db.prepare("INSERT OR REPLACE INTO chart_records (record_date, game_name, result_val) VALUES (?, ?, ?)");
        initialChartData.forEach(c => stmtChart.run(c));
        stmtChart.finalize();
        console.log('Seeded default August 2026 Chart Records');
        syncJSONBackup();
      }
    } else {
      console.log(`Existing ${row.count} chart records preserved in database.`);
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

    db.all("SELECT * FROM games ORDER BY sort_order ASC, id ASC", [], (err, games) => {
      if (err) return res.status(500).json({ error: err.message });
      data.games = games || [];

      // Hero games filter
      let heroGames = (games || []).filter(g => g.is_hero === 1);
      if (heroGames.length === 0 && data.settings.hero_games_json) {
        try { heroGames = JSON.parse(data.settings.hero_games_json); } catch(e) {}
      }
      if (!heroGames || heroGames.length === 0) {
        heroGames = [
          { name: 'RAJ SHREE', today_result: 'WAIT' },
          { name: 'UDAIPUR CITY', today_result: 'WAIT' }
        ];
      }
      data.hero_games = heroGames;

      db.all("SELECT * FROM chart_records ORDER BY record_date ASC", [], (err, charts) => {
        charts = charts || [];

        // Merge any missing records from data_backup.json (e.g. 10-08 or newest dates)
        const bPath = getBackupFileToRead();
        if (bPath) {
          try {
            const backup = JSON.parse(fs.readFileSync(bPath, 'utf8'));
            if (backup && backup.chart_records && backup.chart_records.length > 0) {
              const recordsMap = {};
              charts.forEach(c => {
                if (c && c.record_date && c.game_name) {
                  recordsMap[`${c.record_date.trim()}_${c.game_name.trim().toUpperCase()}`] = c;
                }
              });
              backup.chart_records.forEach(bRecord => {
                if (bRecord && bRecord.record_date && bRecord.game_name) {
                  const key = `${bRecord.record_date.trim()}_${bRecord.game_name.trim().toUpperCase()}`;
                  if (!recordsMap[key]) {
                    charts.push(bRecord);
                    recordsMap[key] = bRecord;
                  } else if (bRecord.result_val && bRecord.result_val !== '-' && (!recordsMap[key].result_val || recordsMap[key].result_val === '-' || recordsMap[key].result_val === '')) {
                    recordsMap[key].result_val = bRecord.result_val;
                  }
                }
              });
            }
          } catch(e) {}
        }
        data.chart_records = charts;

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

// Backup Sync Engine for persistent storage
const bundledBackupPath = path.join(__dirname, 'data_backup.json');
const tmpBackupPath = process.env.VERCEL ? '/tmp/data_backup.json' : bundledBackupPath;
const backupFilePath = tmpBackupPath;

function getBackupFileToRead() {
  if (fs.existsSync(tmpBackupPath)) return tmpBackupPath;
  if (fs.existsSync(bundledBackupPath)) return bundledBackupPath;
  return null;
}

function syncJSONBackup() {
  const fullData = {};
  db.all("SELECT key, value FROM site_settings", [], (err, settings) => {
    fullData.settings = {};
    (settings || []).forEach(s => fullData.settings[s.key] = s.value);

    db.all("SELECT * FROM games ORDER BY sort_order ASC, id ASC", [], (err, games) => {
      fullData.games = games || [];

      db.all("SELECT * FROM chart_records ORDER BY record_date ASC", [], (err, charts) => {
        fullData.chart_records = charts || [];

        db.all("SELECT * FROM blogs ORDER BY id DESC", [], (err, blogs) => {
          fullData.blogs = blogs || [];
          try {
            const jsonStr = JSON.stringify(fullData, null, 2);
            fs.writeFileSync(tmpBackupPath, jsonStr);
            if (tmpBackupPath !== bundledBackupPath) {
              try { fs.writeFileSync(bundledBackupPath, jsonStr); } catch(e) {}
            }
          } catch (e) {
            console.error('Error writing backup file:', e);
          }
          // Instant Push to Supabase Cloud DB
          pushToSupabase(fullData);
        });
      });
    });
  });
}

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
    
    syncJSONBackup();
    res.json({ success: true, message: 'Game updated successfully' });
  });
});

// Admin: Add New Game
app.post('/api/admin/add-game', (req, res) => {
  const { name, open_time, yesterday_result, today_result, table_group } = req.body;
  const sql = "INSERT INTO games (name, open_time, close_time, yesterday_result, today_result, table_group, sort_order) VALUES (?, ?, ?, ?, ?, ?, 99)";
  db.run(sql, [name, open_time, open_time, yesterday_result || '', today_result || 'WAIT', table_group || 1], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    syncJSONBackup();
    res.json({ success: true, id: this.lastID });
  });
});

// Admin: Save / Update Hero Box Games List
app.post('/api/admin/update-hero-games', (req, res) => {
  const { games } = req.body; // array of { id, name, today_result }
  if (!Array.isArray(games)) return res.status(400).json({ error: 'Invalid games array' });

  // 1. Reset all games is_hero = 0
  db.run("UPDATE games SET is_hero = 0", [], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    const heroItems = games.map(g => ({
      id: g.id || null,
      name: g.name ? g.name.trim().toUpperCase() : '',
      today_result: g.today_result ? g.today_result.trim() : 'WAIT'
    }));

    const heroJsonStr = JSON.stringify(heroItems);

    db.run("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('hero_games_json', ?)", [heroJsonStr], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // 2. Mark is_hero = 1 and update results in games table
      const stmt = db.prepare("UPDATE games SET is_hero = 1, today_result = ? WHERE id = ? OR UPPER(name) = ?");
      heroItems.forEach(g => {
        stmt.run([g.today_result, g.id || -1, g.name]);
      });
      stmt.finalize();

      syncJSONBackup();
      res.json({ success: true, message: 'Hero Box Games updated successfully' });
    });
  });
});

// Admin: Batch Reorder Games (Save Custom Order)
app.post('/api/admin/reorder-games', (req, res) => {
  const { order } = req.body; // array of { id, sort_order }
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order array' });

  const stmt = db.prepare("UPDATE games SET sort_order = ? WHERE id = ?");
  order.forEach(item => {
    stmt.run([item.sort_order, item.id]);
  });
  stmt.finalize();

  syncJSONBackup();
  res.json({ success: true, message: 'Games reordered successfully' });
});

// Admin: Delete Game
app.post('/api/admin/delete-game', (req, res) => {
  const { id } = req.body;
  db.run("DELETE FROM games WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    syncJSONBackup();
    res.json({ success: true });
  });
});

// Admin: Save/Update Single Chart Cell
app.post('/api/admin/update-chart-cell', (req, res) => {
  const { record_date, game_name, result_val } = req.body;
  const sql = "INSERT OR REPLACE INTO chart_records (record_date, game_name, result_val) VALUES (?, ?, ?)";
  db.run(sql, [record_date, game_name, result_val], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    syncJSONBackup();
    res.json({ success: true });
  });
});

// Admin: Save/Update Batch Chart Cells (Instant High-Speed Save)
app.post('/api/admin/update-chart-batch', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.json({ success: true, count: 0 });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare("INSERT OR REPLACE INTO chart_records (record_date, game_name, result_val) VALUES (?, ?, ?)");
    items.forEach(item => {
      stmt.run([item.record_date, item.game_name, item.result_val]);
    });
    stmt.finalize();
    db.run("COMMIT", (err) => {
      if (err) return res.status(500).json({ error: err.message });
      syncJSONBackup();
      res.json({ success: true, count: items.length });
    });
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
    syncJSONBackup();
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
      syncJSONBackup();
      res.json({ success: true });
    });
  } else {
    const sql = "INSERT INTO blogs (title, slug, image, post_date, tags, content) VALUES (?, ?, ?, ?, ?, ?)";
    db.run(sql, [title, slug, image, post_date, tags, content], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      syncJSONBackup();
      res.json({ success: true, id: this.lastID });
    });
  }
});

// Admin: Delete Blog Post
app.post('/api/admin/delete-blog', (req, res) => {
  const { id } = req.body;
  db.run("DELETE FROM blogs WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    syncJSONBackup();
    res.json({ success: true });
  });
});

// Admin: Change Password
app.post('/api/admin/change-password', (req, res) => {
  const { new_password } = req.body;
  const hash = bcrypt.hashSync(new_password, 10);
  db.run("UPDATE admin SET password = ? WHERE username = 'A77SattaOfficial'", [hash], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    syncJSONBackup();
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
