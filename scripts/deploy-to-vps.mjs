/**
 * deploy-to-vps.mjs
 * 
 * Script de Automação de Instalação e Deploy Completo na VPS Contabo:
 * IP: 169.58.159.77 (Ubuntu 24.04, 6 vCPUs, 12 GB RAM)
 */

import { Client } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';
const LOCAL_ZIP_PATH = path.resolve('project.zip');

function executeRemote(conn, command, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n⏳ [EXECUTANDO: ${label}]`);
    console.log(`$ ${command}`);

    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let stdout = '';
      let stderr = '';

      stream.on('close', (code, signal) => {
        if (code === 0) {
          console.log(`✅ [SUCESSO: ${label}] (Exit Code 0)`);
          resolve(stdout);
        } else {
          console.error(`❌ [FALHA: ${label}] (Exit Code ${code})`);
          console.error(`Stderr: ${stderr.slice(-500)}`);
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      stream.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data.toString());
      });

      stream.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data.toString());
      });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    console.log(`\n📤 [UPLOADING SFTP: ${localPath} -> ${remotePath}]`);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);

      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);

      writeStream.on('close', () => {
        console.log(`✅ [UPLOAD COMPLETO: ${remotePath}]`);
        resolve();
      });

      writeStream.on('error', (uploadErr) => {
        reject(uploadErr);
      });

      readStream.pipe(writeStream);
    });
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log(`🚀 INICIANDO INSTALAÇÃO E DEPLOY AUTOMATIZADO NA VPS ${VPS_HOST}`);
  console.log('='.repeat(80));

  const conn = new Client();

  conn.on('ready', async () => {
    console.log('✅ Conexão SSH estabelecida com sucesso!');

    try {
      // 1. Atualização do sistema e pacotes fundamentais
      await executeRemote(
        conn,
        'DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y curl wget git unzip nginx ufw htop build-essential fail2ban',
        'Passo 1: Instalação de Pacotes do Sistema'
      );

      // 2. Configuração de Firewall UFW
      await executeRemote(
        conn,
        'ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable',
        'Passo 2: Configuração do Firewall UFW (Portas 22, 80, 443)'
      );

      // 3. Instalação do Docker e Docker Compose
      await executeRemote(
        conn,
        'which docker || (curl -fsSL https://get.docker.com | sh && systemctl enable docker && systemctl start docker)',
        'Passo 3: Instalação do Docker Engine & Docker Compose'
      );

      // 4. Instalação do Node.js 22 LTS, PNPM e PM2
      await executeRemote(
        conn,
        'which node || (curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs && npm install -g pnpm pm2)',
        'Passo 4: Instalação do Node.js 22 LTS, PNPM e PM2'
      );

      // 5. Upload do projeto compactado via SFTP
      await uploadFile(conn, LOCAL_ZIP_PATH, '/root/project.zip');

      // 6. Descompactar e preparar diretório /root/app
      await executeRemote(
        conn,
        'mkdir -p /root/app && unzip -o /root/project.zip -d /root/app && cd /root/app && ls -la',
        'Passo 5: Descompactação do Projeto em /root/app'
      );

      // 7. Instalação de dependências do monorepo
      await executeRemote(
        conn,
        'cd /root/app && pnpm install --frozen-lockfile=false',
        'Passo 6: Instalação de Dependências PNPM'
      );

      // 8. Build dos frontends (Terminal Web e Admin)
      await executeRemote(
        conn,
        'cd /root/app && pnpm -C apps/web build && pnpm -C apps/admin build',
        'Passo 7: Compilação de Produção dos Frontends'
      );

      // 9. Configuração do Nginx como Proxy Reverso Profissional
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

    # WebSocket do Feed de Ticks em Tempo Real a 60fps
    location /ws {
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

      await executeRemote(
        conn,
        `cat << 'EOF' > /etc/nginx/sites-available/broker\n${nginxConfig}\nEOF\n` +
        'rm -f /etc/nginx/sites-enabled/default && ln -sf /etc/nginx/sites-available/broker /etc/nginx/sites-enabled/ && nginx -t && systemctl restart nginx',
        'Passo 8: Configuração do Nginx Reverse Proxy'
      );

      // 9. Subir ecossistema Docker Compose oficial (PostgreSQL, Redis, Keycloak, Blnk, etc.)
      await executeRemote(
        conn,
        'cd /root/app && docker compose -f infra/compose.yaml up -d && sleep 10 && docker compose -f infra/compose.yaml ps',
        'Passo 9: Inicialização do Docker Compose (Postgres, Redis, Keycloak, Blnk)'
      );

      // 10. Iniciar serviços de background com PM2
      await executeRemote(
        conn,
        'pm2 delete all || true; cd /root/app && pm2 start scripts/dev-live-feed.mjs --name "broker-feed" && pm2 save',
        'Passo 10: Inicialização dos Serviços de Cotações com PM2'
      );

      // 11. Execução de testes de conformidade na própria VPS
      await executeRemote(
        conn,
        'cd /root/app && node tests/test-fase1-mvp-eight-features.mjs',
        'Passo 11: Execução da Suíte de Testes das 8 Features na VPS'
      );

      // 12. Execução da Bateria E2E Integrada de Login e Ledger na VPS
      await executeRemote(
        conn,
        'cd /root/app && node tests/test-keycloak-blnk-wallet-e2e.mjs',
        'Passo 12: Execução da Homologação E2E Keycloak & Blnk na VPS'
      );

      // 13. Verificação de Saúde HTTP via curl local
      await executeRemote(
        conn,
        'curl -I http://127.0.0.1/ && curl -s http://127.0.0.1/health && curl -s http://127.0.0.1/api/candles?symbol=SYNTH_VOL_50 | head -c 200',
        'Passo 11: Verificação Final de Endpoints Públicos'
      );

      console.log('\n' + '='.repeat(80));
      console.log('🎉 IMPLANTAÇÃO CONCLUÍDA COM 100% DE SUCESSO NA SUA VPS!');
      console.log(`🌐 Acesse agora mesmo no navegador: http://${VPS_HOST}/`);
      console.log(`📊 Painel Administrativo: http://${VPS_HOST}/admin-ui/`);
      console.log(`📈 Métricas Prometheus: http://${VPS_HOST}/metrics`);
      console.log('='.repeat(80));

      conn.end();
    } catch (err) {
      console.error('❌ Erro durante o processo de deploy:', err);
      conn.end();
      process.exit(1);
    }
  });

  conn.on('error', (err) => {
    console.error('❌ Erro de conexão SSH:', err);
    process.exit(1);
  });

  conn.connect({
    host: VPS_HOST,
    port: 22,
    username: VPS_USER,
    password: VPS_PASS,
    readyTimeout: 30000
  });
}

main();
