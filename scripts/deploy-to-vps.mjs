import { Client } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

function packTarGz(srcDir, archiveName) {
  if (fs.existsSync(archiveName)) {
    fs.unlinkSync(archiveName);
  }
  console.log(`📦 Gerando pacote ${archiveName} a partir de ${srcDir}...`);
  execSync(`tar -czf ${archiveName} -C ${srcDir} .`);
  console.log(`✅ ${archiveName} gerado com sucesso (${fs.statSync(archiveName).size} bytes)`);
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
  packTarGz('apps/web/dist', 'web-dist.tar.gz');
  if (fs.existsSync('apps/admin/dist')) {
    packTarGz('apps/admin/dist', 'admin-dist.tar.gz');
  }

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

  await execCommand(
    conn,
    'mkdir -p /root/app/scripts/lib /root/app/scripts/sentiment /root/app/services/tick-engine /root/app/services/api/src/routes /root/app/db/migrations /root/app/apps/web/dist /root/app/apps/admin/dist',
  );

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftpClient) => {
      if (err) reject(err);
      else resolve(sftpClient);
    });
  });

  // 1. Upload dos pacotes frontend (web + admin)
  await uploadFile(sftp, 'web-dist.tar.gz', '/root/web-dist.tar.gz');
  if (fs.existsSync('admin-dist.tar.gz')) {
    await uploadFile(sftp, 'admin-dist.tar.gz', '/root/admin-dist.tar.gz');
  }

  // 2. Upload do backend principal e módulos em scripts/lib e scripts/sentiment
  await uploadFile(sftp, 'scripts/dev-live-feed.mjs', '/root/app/scripts/dev-live-feed.mjs');

  const libFiles = fs.readdirSync('scripts/lib').filter(f => f.endsWith('.mjs'));
  for (const file of libFiles) {
    await uploadFile(sftp, path.posix.join('scripts/lib', file), `/root/app/scripts/lib/${file}`);
  }

  await uploadFile(
    sftp,
    'scripts/sentiment/sentiment-service.mjs',
    '/root/app/scripts/sentiment/sentiment-service.mjs',
  );

  // 3. Upload do tick-engine e rotas auxiliares
  const tickEngineFiles = ['core.mjs', 'engine.mjs', 'live-market-store.mjs'];
  for (const file of tickEngineFiles) {
    if (fs.existsSync(`services/tick-engine/${file}`)) {
      await uploadFile(
        sftp,
        `services/tick-engine/${file}`,
        `/root/app/services/tick-engine/${file}`,
      );
    }
  }

  if (fs.existsSync('services/api/src/routes/chart.ts')) {
    await uploadFile(
      sftp,
      'services/api/src/routes/chart.ts',
      '/root/app/services/api/src/routes/chart.ts',
    );
  }

  if (fs.existsSync('db/migrations/0063_contracts_entry_tick_sequence.up.sql')) {
    await uploadFile(
      sftp,
      'db/migrations/0063_contracts_entry_tick_sequence.up.sql',
      '/root/app/db/migrations/0063_contracts_entry_tick_sequence.up.sql',
    );
  }

  // 4. Descompactar bundles, ajustar permissões, recarregar Nginx e reiniciar PM2
  const remoteScript = `
echo "=== Descompactando Frontend Web ==="
rm -rf /root/app/apps/web/dist/*
tar -xzf /root/web-dist.tar.gz -C /root/app/apps/web/dist
chmod -R 755 /root/app/apps/web/dist

if [ -f /root/admin-dist.tar.gz ]; then
  echo "=== Descompactando Frontend Admin ==="
  rm -rf /root/app/apps/admin/dist/*
  tar -xzf /root/admin-dist.tar.gz -C /root/app/apps/admin/dist
  chmod -R 755 /root/app/apps/admin/dist
fi

chmod 755 /root /root/app /root/app/apps /root/app/apps/web /root/app/apps/admin

echo "=== Recarregando Nginx e PM2 ==="
nginx -t && systemctl reload nginx
pm2 restart broker-feed
sleep 3

echo "=== Status dos Processos PM2 ==="
pm2 status
`;

  await execCommand(conn, remoteScript);

  // 5. Smoke tests remotos completos (#7, #11, #12, #13 e saúde geral)
  const smokeTests = `
echo "=== Smoke Test 1: Frontend Bundle ==="
curl -s http://127.0.0.1/ | grep -o 'assets/index-[^"]*\\.js'

echo "=== Smoke Test 2: Health Check ==="
curl -s http://127.0.0.1:3001/health
echo ""

echo "=== Smoke Test 3: Velas 5s Reais (#11) ==="
curl -s "http://127.0.0.1:3001/api/candles?symbol=VOL_50&interval=5s&limit=5" | head -c 350
echo ""

echo "=== Smoke Test 4: Traders Mood Sentiment (#13) ==="
curl -s "http://127.0.0.1:3001/api/sentiment?symbol=VOL_50"
echo ""

echo "=== Smoke Test 5: Câmbio LATAM (#7) ==="
curl -s "http://127.0.0.1:3001/api/exchange-rates" | head -c 300
echo ""

echo "=== Smoke Test 6: Métricas Prometheus (#11) ==="
curl -s "http://127.0.0.1:3001/metrics" | grep -E "candle_rebuild_divergences_total|tick_dispatch_latency_ms_count"
`;

  await execCommand(conn, smokeTests);

  // Limpar arquivos temporários locais
  if (fs.existsSync('web-dist.tar.gz')) fs.unlinkSync('web-dist.tar.gz');
  if (fs.existsSync('admin-dist.tar.gz')) fs.unlinkSync('admin-dist.tar.gz');

  console.log('\n🎉 Deploy completo para VPS concluído com 100% de sucesso!');
  conn.end();
}

main().catch(err => {
  console.error('❌ Falha no deploy:', err);
  process.exit(1);
});
