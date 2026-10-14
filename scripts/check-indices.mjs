import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  const sql = "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'kyc_profiles';";
  conn.exec(`docker exec -i broker-postgres psql -U synth_migrator -d broker_platform -c "${sql}"`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '169.58.159.77', port: 22, username: 'root', password: 'NqBxE5RrCwSd' });
