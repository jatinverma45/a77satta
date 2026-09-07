const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.sszqmfagodieabgsbzev:SattaaA77king@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const kGame = await pool.query("SELECT * FROM games WHERE name = 'KASHMIRI BAZAR'");
    console.log("=== KASHMIRI BAZAR in games table ===");
    console.table(kGame.rows);

    const kCharts = await pool.query("SELECT * FROM chart_records WHERE game_name = 'KASHMIRI BAZAR' AND record_date LIKE '%-09' ORDER BY record_date ASC");
    console.log("=== KASHMIRI BAZAR in chart_records table (Sept) ===");
    console.table(kCharts.rows);

    const allWith81 = await pool.query("SELECT * FROM chart_records WHERE result_val = '81'");
    console.log("=== Any chart record with '81' ===");
    console.table(allWith81.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
