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
    console.log('✅ SSH conectado para atualização do Terminal Web');

    conn.sftp((err, sftp) => {
      if (err) throw err;
      const readStream = fs.createReadStream('web-dist.zip');
      const writeStream = sftp.createWriteStream('/root/web-dist.zip');

      writeStream.on('close', () => {
        console.log('✅ Upload de web-dist.zip concluído');

        const script = `
rm -rf /root/app/apps/web/dist/*
unzip -o /root/web-dist.zip -d /root/app/apps/web/dist
chmod -R 755 /root/app/apps/web/dist
systemctl reload nginx
`;

        conn.exec(script, (execErr, stream) => {
          if (execErr) throw execErr;
          stream.on('close', (code) => {
            console.log(`✅ Deploy do Terminal Web finalizado com Exit Code ${code}`);
            conn.end();
            process.exit(code);
          });
          stream.on('data', d => process.stdout.write(d));
          stream.stderr.on('data', d => process.stderr.write(d));
        });
      });

      readStream.pipe(writeStream);
    });
  }).connect({
    host: VPS_HOST,
    port: 22,
    username: VPS_USER,
    password: VPS_PASS
  });
}

main().catch(console.error);
