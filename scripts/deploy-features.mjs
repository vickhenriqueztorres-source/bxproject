import { Client } from 'ssh2';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

function zipWebDist() {
  if (fs.existsSync('web-dist.zip')) fs.unlinkSync('web-dist.zip');
  execSync('powershell Compress-Archive -Path apps/web/dist/* -DestinationPath web-dist.zip -Force');
  console.log(`📦 web-dist.zip criado (${fs.statSync('web-dist.zip').size} bytes)`);
}

async function main() {
  zipWebDist();

  const conn = new Client();
  conn.on('ready', () => {
    console.log('✅ SSH conectado para atualização das 3 Features na VPS');

    conn.sftp((err, sftp) => {
      if (err) throw err;
      
      // Upload do web-dist.zip
      const readStreamDist = fs.createReadStream('web-dist.zip');
      const writeStreamDist = sftp.createWriteStream('/root/web-dist.zip');

      writeStreamDist.on('close', () => {
        console.log('✅ Upload de web-dist.zip concluído');

        // Upload do scripts/dev-live-feed.mjs atualizado
        const readStreamFeed = fs.createReadStream('scripts/dev-live-feed.mjs');
        const writeStreamFeed = sftp.createWriteStream('/root/app/scripts/dev-live-feed.mjs');

        writeStreamFeed.on('close', () => {
          console.log('✅ Upload de dev-live-feed.mjs concluído');

          const script = `
rm -rf /root/app/apps/web/dist/*
unzip -o /root/web-dist.zip -d /root/app/apps/web/dist
chmod -R 755 /root/app/apps/web/dist
systemctl reload nginx
pm2 restart broker-feed
pm2 status
`;

          conn.exec(script, (execErr, stream) => {
            if (execErr) throw execErr;
            stream.on('close', (code) => {
              console.log(`✅ Deploy das 3 Features finalizado com Exit Code ${code}`);
              conn.end();
              process.exit(code);
            });
            stream.on('data', d => process.stdout.write(d));
            stream.stderr.on('data', d => process.stderr.write(d));
          });
        });

        readStreamFeed.pipe(writeStreamFeed);
      });

      readStreamDist.pipe(writeStreamDist);
    });
  }).connect({
    host: VPS_HOST,
    port: 22,
    username: VPS_USER,
    password: VPS_PASS
  });
}

main().catch(console.error);
