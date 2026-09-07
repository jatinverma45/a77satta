const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.sszqmfagodieabgsbzev:SattaaA77king@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM chart_records WHERE record_date IN ('2026-09-07', '07-09')");
    console.log("=== All records for 2026-09-07 and 07-09 ===");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
