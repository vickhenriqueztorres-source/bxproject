import { Client } from 'ssh2';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

// Compactar apps/web/dist em web-dist.zip via PowerShell
function zipWebDist() {
  if (fs.existsSync('web-dist.zip')) fs.unlinkSync('web-dist.zip');
  execSync('powershell Compress-Archive -Path apps/web/dist/* -DestinationPath web-dist.zip -Force');
  console.log(`📦 web-dist.zip criado (${fs.statSync('web-dist.zip').size} bytes)`);
}

async function uploadFile(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    const r = fs.createReadStream(local);
    const w = sftp.createWriteStream(remote);
    w.on('close', () => {
      console.log(`✅ Upload: ${remote}`);
      resolve();
    });
    w.on('error', reject);
    r.pipe(w);
  });
}

async function main() {
  zipWebDist();

  const conn = new Client();
  conn.on('ready', () => {
    console.log('✅ SSH conectado');

    conn.sftp(async (err, sftp) => {
      if (err) throw err;

      await uploadFile(sftp, 'web-dist.zip', '/root/web-dist.zip');
      await uploadFile(sftp, 'scripts/dev-live-feed.mjs', '/root/app/scripts/dev-live-feed.mjs');

      const remoteCommands = [
        'rm -rf /root/app/apps/web/dist',
        'mkdir -p /root/app/apps/web/dist',
        'unzip -o /root/web-dist.zip -d /root/app/apps/web/dist',
        'chmod -R 755 /root/app/apps/web/dist',
        'pm2 restart broker-feed',
        'sleep 2',
        'curl -s http://127.0.0.1:3001/api/indices/SYNTH_VOL_50',
        'curl -s http://127.0.0.1:3001/api/wallet'
      ].join(' && ');

      conn.exec(remoteCommands, (execErr, stream) => {
        if (execErr) throw execErr;
        stream.on('close', (code) => {
          console.log(`✅ Atualização finalizada com Exit Code ${code}`);
          conn.end();
          process.exit(code);
        });
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
      });
    });
  }).connect({
    host: VPS_HOST,
    port: 22,
    username: VPS_USER,
    password: VPS_PASS
  });
}

main().catch(console.error);
