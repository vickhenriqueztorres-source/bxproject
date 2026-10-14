import { Client } from 'ssh2';

const content = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    ssl_certificate /etc/ssl/certs/binmax.crt;
    ssl_certificate_key /etc/ssl/private/binmax.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/etc/nginx/sites-available/broker');
    stream.write(content);
    stream.end();
    stream.on('close', () => {
      conn.exec('nginx -t && systemctl reload nginx', (err, proc) => {
        proc.on('data', d => process.stdout.write(d));
        proc.stderr.on('data', d => process.stderr.write(d));
        proc.on('close', () => {
          conn.end();
          console.log('\nNginx configurado e recarregado com sucesso!');
        });
      });
    });
  });
}).connect({ host: '169.58.159.77', port: 22, username: 'root', password: 'NqBxE5RrCwSd' });
