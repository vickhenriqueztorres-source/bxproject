import { Client } from 'ssh2';
import fs from 'node:fs';

const sql = fs.readFileSync('db/migrations/0045_kyc_and_community_modules.up.sql', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ Conectado na VPS. Aplicando migration 0045...');
  const proc = conn.exec('docker exec -i broker-postgres psql -U synth_migrator -d broker_platform', (err, stream) => {
    if (err) throw err;
    let out = '';
    let errOut = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => errOut += d);
    stream.on('close', code => {
      console.log('--- Output psql ---');
      console.log(out || errOut);
      console.log(`✅ Exit code: ${code}`);
      conn.end();
      process.exit(code);
    });
    stream.write(sql);
    stream.end();
  });
}).connect({ host: '169.58.159.77', port: 22, username: 'root', password: 'NqBxE5RrCwSd' });
