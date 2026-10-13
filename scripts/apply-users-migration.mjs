import { Client } from 'ssh2';
import fs from 'fs';

const sql40 = fs.readFileSync('db/migrations/0040_users_and_auth.up.sql', 'utf8');
const sql41 = fs.readFileSync('db/migrations/0041_identity_subject_links.up.sql', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  console.log('Conectado à VPS. Aplicando migrations 0040 e 0041...');
  const combinedSql = sql40 + '\n\n' + sql41;
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/tmp/migrations_auth.sql');
    stream.write(combinedSql);
    stream.end();
    stream.on('close', () => {
      conn.exec('docker exec -i broker-postgres psql -U synth_migrator -d broker_platform < /tmp/migrations_auth.sql', (err, proc) => {
        proc.on('data', d => process.stdout.write(d));
        proc.stderr.on('data', d => process.stderr.write(d));
        proc.on('close', code => {
          console.log('\nMigration concluída com código:', code);
          conn.exec('docker exec broker-postgres psql -U synth_migrator -d broker_platform -c "\\d users"', (err, chk) => {
            chk.on('data', d => process.stdout.write(d));
            chk.on('close', () => conn.end());
          });
        });
      });
    });
  });
}).connect({ host: '169.58.159.77', port: 22, username: 'root', password: 'NqBxE5RrCwSd' });
