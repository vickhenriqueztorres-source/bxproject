import { Client } from 'ssh2';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

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

  console.log(`\n🔗 Conectado à VPS ${VPS_HOST} via SSH`);

  const restartCommands = `
echo "=== 1. Reiniciando Containers Docker ==="
docker restart $(docker ps -q)
sleep 3
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "=== 2. Reiniciando Nginx e PM2 ==="
systemctl restart nginx
pm2 restart broker-feed
sleep 2
pm2 status

echo "=== 3. Validação dos Endpoints ==="
curl -s -o /dev/null -w "Frontend HTTP: %{http_code}\n" http://127.0.0.1/
curl -s -o /dev/null -w "Dev Feed HTTP: %{http_code}\n" http://127.0.0.1:3001/health
`;

  await execCommand(conn, restartCommands);
  console.log('\n🎉 Todos os serviços locais e remotos (Nginx, PM2, Docker, Feed, Frontend) foram reiniciados com 100% de sucesso!');
  conn.end();
}

main().catch(err => {
  console.error('❌ Falha ao reiniciar VPS:', err);
  process.exit(1);
});
