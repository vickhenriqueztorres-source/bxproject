import { Client } from 'ssh2';
import fs from 'fs';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

const conn = new Client();
conn.on('ready', () => {
  console.log('Conectado à VPS. Enviando scripts/dev-live-feed.mjs...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const readStream = fs.createReadStream('scripts/dev-live-feed.mjs');
    const writeStream = sftp.createWriteStream('/root/app/scripts/dev-live-feed.mjs');
    
    writeStream.on('close', () => {
      console.log('Upload concluído! Reiniciando broker-feed no PM2...');
      conn.exec('pm2 restart broker-feed && sleep 1 && pm2 status', (err, proc) => {
        proc.on('data', d => process.stdout.write(d));
        proc.stderr.on('data', d => process.stderr.write(d));
        proc.on('close', code => {
          console.log('\nPM2 restart finalizado com código:', code);
          conn.end();
        });
      });
    });
    
    readStream.pipe(writeStream);
  });
}).connect({ host: VPS_HOST, port: 22, username: VPS_USER, password: VPS_PASS });
