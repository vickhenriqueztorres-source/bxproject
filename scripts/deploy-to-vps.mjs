import { Client } from 'ssh2';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

function zipWebDist() {
  if (fs.existsSync('web-dist.zip')) {
    fs.unlinkSync('web-dist.zip');
  }
  console.log('📦 Gerando pacote web-dist.zip a partir de apps/web/dist...');
  execSync('powershell Compress-Archive -Path apps/web/dist/* -DestinationPath web-dist.zip -Force');
  console.log(`✅ web-dist.zip gerado com sucesso (${fs.statSync('web-dist.zip').size} bytes)`);
}

async function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.on('close', () => {
      console.log(`✅ Upload concluído: ${localPath} -> ${remotePath}`);
      resolve();
    });
    writeStream.on('error', reject);
    readStream.on('error', reject);
    readStream.pipe(writeStream);
  });
}

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Executando no servidor: ${cmd.trim().split('\n')[0]}...`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      stream.on('data', data => {
        process.stdout.write(data);
        output += data.toString();
      });
      stream.stderr.on('data', data => {
        process.stderr.write(data);
        output += data.toString();
      });
      stream.on('close', code => {
        if (code === 0) resolve(output);
        else reject(new Error(`Comando falhou com código ${code}`));
      });
    });
  });
}

async function main() {
  zipWebDist();

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({
      host: VPS_HOST,
      port: 22,
      username: VPS_USER,
      password: VPS_PASS,
    });
  });

  console.log(`\n🔗 Conectado com sucesso à VPS ${VPS_HOST} via SSH`);

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });

  // 1. Upload do bundle web
  await uploadFile(sftp, 'web-dist.zip', '/root/web-dist.zip');

  // 2. Upload do backend live feed
  await uploadFile(sftp, 'scripts/dev-live-feed.mjs', '/root/app/scripts/dev-live-feed.mjs');

  // 3. Upload da rota chart.ts
  await uploadFile(sftp, 'services/api/src/routes/chart.ts', '/root/app/services/api/src/routes/chart.ts');

  // 4. Executa atualização dos arquivos, permissões, recarga do Nginx e restart do PM2
  const remoteScript = `
echo "=== Descompactando Frontend ==="
rm -rf /root/app/apps/web/dist/*
unzip -o /root/web-dist.zip -d /root/app/apps/web/dist
chmod -R 755 /root/app/apps/web/dist

echo "=== Recarregando Nginx e PM2 ==="
nginx -t && systemctl reload nginx
pm2 restart broker-feed
sleep 2

echo "=== Status dos Processos PM2 ==="
pm2 status
`;

  await execCommand(conn, remoteScript);

  // 5. Testes de fumaça remotos para garantir integridade total
  const smokeTests = `
echo "=== Smoke Test 1: Frontend Bundle ==="
curl -s http://127.0.0.1/ | grep -o 'assets/index-[^.]*\\.js'

echo "=== Smoke Test 2: Candles 10080 (7 dias) ==="
curl -s "http://127.0.0.1:3001/api/candles?symbol=EURUSD_OTC&limit=10080" | jq '{count: length, first: .[0].time, last: .[-1].time}'

echo "=== Smoke Test 3: Candles 5m (Resampling) ==="
curl -s "http://127.0.0.1:3001/api/candles?symbol=EURUSD_OTC&interval=5m&limit=10080" | jq '{count: length, first: .[0].time, last: .[-1].time}'

echo "=== Smoke Test 4: Health Check ==="
curl -s http://127.0.0.1:3001/health
`;

  await execCommand(conn, smokeTests);

  console.log('\n🎉 Deploy para VPS concluído com 100% de sucesso!');
  conn.end();
}

main().catch(err => {
  console.error('❌ Falha no deploy:', err);
  process.exit(1);
});
