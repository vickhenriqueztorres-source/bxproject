import { Client } from 'ssh2';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

// Compactar apps/admin/dist em admin-dist.zip
function zipAdminDist() {
  if (fs.existsSync('admin-dist.zip')) fs.unlinkSync('admin-dist.zip');
  execSync('powershell Compress-Archive -Path apps/admin/dist/* -DestinationPath admin-dist.zip -Force');
  console.log(`📦 admin-dist.zip criado via PowerShell (${fs.statSync('admin-dist.zip').size} bytes)`);
}

const nginxConfig = `
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    # Redirecionamento amigavel para /admin/ e /admin-ui/
    location = /admin {
        return 301 /admin/;
    }

    location = /admin-ui {
        return 301 /admin-ui/;
    }

    # Painel Administrativo em /admin/
    location ^~ /admin/ {
        alias /root/app/apps/admin/dist/;
        index index.html;
        try_files $uri $uri/ /admin/index.html =404;
    }

    # Painel Administrativo em /admin-ui/
    location ^~ /admin-ui/ {
        alias /root/app/apps/admin/dist/;
        index index.html;
        try_files $uri $uri/ /admin-ui/index.html =404;
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

    # Terminal Web (Frontend Principal)
    location / {
        root /root/app/apps/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
`;

async function main() {
  zipAdminDist();

  const conn = new Client();
  conn.on('ready', () => {
    console.log('✅ SSH conectado');

    conn.sftp((err, sftp) => {
      if (err) throw err;
      const readStream = fs.createReadStream('admin-dist.zip');
      const writeStream = sftp.createWriteStream('/root/admin-dist.zip');

      writeStream.on('close', () => {
        console.log('✅ Upload de admin-dist.zip concluído');

        // Comandos de deploy no servidor
        const script = `
rm -rf /root/app/apps/admin/dist
mkdir -p /root/app/apps/admin/dist
unzip -o /root/admin-dist.zip -d /root/app/apps/admin/dist
chmod -R 755 /root/app/apps/admin/dist

cat << 'EOF' > /etc/nginx/sites-available/broker
${nginxConfig}
EOF

nginx -t && systemctl reload nginx
`;

        conn.exec(script, (execErr, stream) => {
          if (execErr) throw execErr;
          stream.on('close', (code) => {
            console.log(`✅ Atualização de Admin finalizada com Exit Code ${code}`);
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
