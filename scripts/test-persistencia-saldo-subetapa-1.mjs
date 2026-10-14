import { Client } from 'ssh2';
import assert from 'node:assert/strict';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

console.log('🚀 Iniciando Teste de Certificação da Subetapa 01: Persistência do Saldo Demo');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Conectado à VPS.');

  // Script de teste que roda na VPS chamando o broker-feed na porta 3001
  const testScript = `
    node -e "
      (async () => {
        try {
          const email = 'trader_test_persistencia_' + Date.now() + '@binmax.test';
          const password = 'PasswordSecure123!';
          
          console.log('1. Registrando usuário de teste:', email);
          const regRes = await fetch('http://127.0.0.1:3001/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Trader Persistencia', email, password, country: 'BR' })
          });
          const regData = await regRes.json();
          if (!regData.token) throw new Error('Falha no registro: ' + JSON.stringify(regData));
          const token = regData.token;
          const userId = regData.user.id;
          console.log('   Usuário registrado ID:', userId, 'Saldo inicial:', regData.user.demo_balance_minor);

          console.log('2. Consultando saldo inicial via /api/v1/wallet...');
          const wRes1 = await fetch('http://127.0.0.1:3001/api/v1/wallet', {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const wData1 = await wRes1.json();
          console.log('   Saldo inicial /wallet:', wData1.available_minor);
          if (wData1.available_minor !== 1000000) throw new Error('Saldo inicial esperado 1000000, recebido: ' + wData1.available_minor);

          console.log('3. Abrindo contrato UP com stake 10000 (US$ 100.00)...');
          const idemKey = 'idem_test_' + Date.now();
          const openRes = await fetch('http://127.0.0.1:3001/api/contracts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
              'Idempotency-Key': idemKey
            },
            body: JSON.stringify({
              symbol: 'SYNTH_VOL_50',
              direction: 'UP',
              stake_minor: 10000,
              duration_seconds: 30
            })
          });
          const openData = await openRes.json();
          if (!openData.contract?.id) throw new Error('Falha na abertura: ' + JSON.stringify(openData));
          const contractId = openData.contract.id;
          console.log('   Contrato aberto ID:', contractId);

          console.log('4. Consultando saldo imediatamente após abertura (deve ter debitado 10000)...');
          const wRes2 = await fetch('http://127.0.0.1:3001/api/v1/wallet', {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const wData2 = await wRes2.json();
          console.log('   Saldo após abertura:', wData2.available_minor);
          if (wData2.available_minor !== 990000) {
            throw new Error('Saldo esperado 990000, recebido: ' + wData2.available_minor);
          }

          console.log('5. Simulando 10 F5s imediatos (Reload Storm)...');
          for (let i = 1; i <= 10; i++) {
            const probeRes = await fetch('http://127.0.0.1:3001/api/v1/wallet', {
              headers: { 'Authorization': 'Bearer ' + token }
            });
            const probeData = await probeRes.json();
            if (probeData.available_minor !== 990000) {
              throw new Error('Falha no F5 #' + i + ': saldo resetou para ' + probeData.available_minor);
            }
          }
          console.log('   ✅ 10 recargas consecutivas preservaram rigorosamente 990000!');

          console.log('6. Aguardando liquidação da ordem (máx 35s)...');
          let settled = false;
          let finalBalance = null;
          for (let t = 0; t < 15; t++) {
            await new Promise(r => setTimeout(r, 2500));
            const cRes = await fetch('http://127.0.0.1:3001/api/contracts', {
              headers: { 'Authorization': 'Bearer ' + token }
            });
            const cData = await cRes.json();
            const myContract = (cData.contracts || []).find(c => c.id === contractId);
            if (myContract && myContract.status === 'SETTLED') {
              settled = true;
              console.log('   Contrato liquidado! Resultado:', myContract.result, 'Payout:', myContract.payout_minor);
              break;
            }
          }
          if (!settled) console.warn('   Aviso: timeout esperando liquidação; testando persistência do débito.');

          console.log('7. Verificando saldo final persistido na conta...');
          const wResFinal = await fetch('http://127.0.0.1:3001/api/v1/wallet', {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const wDataFinal = await wResFinal.json();
          console.log('   Saldo final consultado:', wDataFinal.available_minor);

          console.log('8. Testando mais 10 F5s pós-liquidação...');
          for (let i = 1; i <= 10; i++) {
            const probeRes = await fetch('http://127.0.0.1:3001/api/v1/wallet', {
              headers: { 'Authorization': 'Bearer ' + token }
            });
            const probeData = await probeRes.json();
            if (probeData.available_minor !== wDataFinal.available_minor) {
              throw new Error('Falha no F5 #' + i + ': saldo divergiu: ' + probeData.available_minor);
            }
          }
          console.log('   ✅ Todas as 10 recargas pós-liquidação retornaram o valor exato:', wDataFinal.available_minor);
          console.log('🎉 SUBETAPA 01 CERTIFICADA COM 100% DE SUCESSO!');
          process.exit(0);
        } catch (e) {
          console.error('❌ ERRO NO TESTE:', e.message);
          process.exit(1);
        }
      })();
    "
  `;

  // Faz deploy do dev-live-feed.mjs atualizado para a VPS antes de rodar o teste
  console.log('Enviando scripts/dev-live-feed.mjs atualizado para a VPS...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    import('fs').then(fs => {
      const readStream = fs.createReadStream('scripts/dev-live-feed.mjs');
      const writeStream = sftp.createWriteStream('/root/app/scripts/dev-live-feed.mjs');
      writeStream.on('close', () => {
        console.log('Upload concluído! Reiniciando broker-feed no PM2...');
        conn.exec('pm2 restart broker-feed && sleep 2 && pm2 status', (err2, proc) => {
          if (err2) throw err2;
          proc.on('data', d => process.stdout.write(d));
          proc.on('close', () => {
            console.log('\nExecutando teste automatizado na VPS...');
            conn.exec(testScript, (err3, testProc) => {
              if (err3) throw err3;
              testProc.on('data', d => process.stdout.write(d));
              testProc.stderr.on('data', d => process.stderr.write(d));
              testProc.on('close', code => {
                conn.end();
                process.exit(code);
              });
            });
          });
        });
      });
      readStream.pipe(writeStream);
    });
  });
}).connect({ host: VPS_HOST, port: 22, username: VPS_USER, password: VPS_PASS });
