const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.sszqmfagodieabgsbzev:SattaaA77king@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // 1. Delete all YYYY-MM-DD format records from chart_records
    const delRes = await pool.query("DELETE FROM chart_records WHERE record_date LIKE '2026-%'");
    console.log("Deleted legacy YYYY-MM-DD records:", delRes.rowCount);

    // 2. Set all 07-09 chart_records to '-' (since 7 September results are not yet declared by admin)
    await pool.query("UPDATE chart_records SET result_val = '-' WHERE record_date = '07-09'");
    console.log("Reset 07-09 chart records to '-'");

    // 3. Set all games today_result to 'WAIT'
    await pool.query("UPDATE games SET today_result = 'WAIT'");
    console.log("Reset all games today_result to 'WAIT'");

    // 4. Verify 06-09 results (yesterday) are intact
    const sep6 = await pool.query("SELECT game_name, result_val FROM chart_records WHERE record_date = '06-09' ORDER BY game_name ASC");
    console.log("Intact 06-09 results:");
    console.table(sep6.rows);

    // Update yesterday_result on games from 06-09 chart_records
    for (const row of sep6.rows) {
      if (row.result_val && row.result_val !== '-') {
        await pool.query("UPDATE games SET yesterday_result = $1 WHERE UPPER(name) = UPPER($2)", [row.result_val, row.game_name]);
      }
    }

    // 5. Sync to data_backup.json
    const [settingsRes, gamesRes, chartsRes, blogsRes] = await Promise.all([
      pool.query('SELECT key, value FROM site_settings'),
      pool.query('SELECT * FROM games ORDER BY sort_order ASC, id ASC'),
      pool.query('SELECT * FROM chart_records ORDER BY record_date ASC'),
      pool.query('SELECT * FROM blogs ORDER BY id DESC')
    ]);

    const settingsObj = {};
    settingsRes.rows.forEach(r => { settingsObj[r.key] = r.value; });

    const fullData = {
      settings: settingsObj,
      games: gamesRes.rows,
      chart_records: chartsRes.rows,
      blogs: blogsRes.rows
    };

    const targetPath = path.join(__dirname, '..', 'data_backup.json');
    fs.writeFileSync(targetPath, JSON.stringify(fullData, null, 2), 'utf8');
    console.log("✅ Successfully synced clean data to data_backup.json!");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
