import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://synth_migrator:dev_secret_pw_123@172.18.0.4:5432/broker_platform',
  connectionTimeoutMillis: 3000,
});

async function main() {
  try {
    const res = await pool.query('SELECT count(*) FROM users');
    console.log('CONEXÃO SUCESSO! Total usuários:', res.rows[0].count);
    await pool.end();
  } catch (err) {
    console.error('ERRO CONEXÃO:', err.message);
    process.exit(1);
  }
}

main();
