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
  console.log(`📦 web-dist.zip criado via PowerShell (${fs.statSync('web-dist.zip').size} bytes)`);
}

const nginxConfig = `
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    # Terminal Web (Frontend Principal)
    location / {
        root /root/app/apps/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Painel Administrativo
    location /admin-ui/ {
        alias /root/app/apps/admin/dist/;
        index index.html;
        try_files $uri $uri/ /admin-ui/index.html;
    }

    # API REST de Cotações, Contratos e Carteira
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rotas de Candles / Candles REST
    location /candles {
        proxy_pass http://127.0.0.1:3001/candles;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Telemetria Prometheus
    location /metrics {
        proxy_pass http://127.0.0.1:3001/metrics;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket do Feed de Ticks em Tempo Real a 60fps (suporta tanto /ws quanto /ticks)
    location ~* ^/(ws|ticks) {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Keycloak IAM (Autenticação OIDC)
    location /realms/ {
        proxy_pass http://127.0.0.1:8080/realms/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health Check
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        proxy_http_version 1.1;
    }
}
`;

async function main() {
  await zipWebDist();

  const conn = new Client();
  conn.on('ready', () => {
    console.log('✅ SSH conectado');

    conn.sftp((err, sftp) => {
      if (err) throw err;
      const readStream = fs.createReadStream('web-dist.zip');
      const writeStream = sftp.createWriteStream('/root/web-dist.zip');

      writeStream.on('close', () => {
        console.log('✅ Upload de web-dist.zip concluído');

        const remoteCommands = [
          'rm -rf /root/app/apps/web/dist',
          'mkdir -p /root/app/apps/web/dist',
          'unzip -o /root/web-dist.zip -d /root/app/apps/web/dist',
          'chmod -R 755 /root/app/apps/web/dist',
          `cat << 'EOF' > /etc/nginx/sites-available/broker\n${nginxConfig}\nEOF`,
          'nginx -t && systemctl reload nginx',
          'pm2 restart broker-feed || pm2 start /root/app/scripts/dev-live-feed.mjs --name "broker-feed"',
          'pm2 save',
          'curl -I http://127.0.0.1/ | head -n 4'
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
