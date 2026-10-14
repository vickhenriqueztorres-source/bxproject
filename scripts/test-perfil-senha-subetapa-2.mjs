import { Client } from 'ssh2';

const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

console.log('🚀 Iniciando Teste de Certificação da Subetapa 02: Configuração de Conta e Perfil');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Conectado à VPS.');

  const testScript = `
    node -e "
      (async () => {
        try {
          const email = 'trader_profile_test_' + Date.now() + '@binmax.test';
          const oldPassword = 'OldSecurePassword123!';
          const newPassword = 'NewUltraPassword456!';

          console.log('1. Registrando novo usuário para teste de perfil:', email);
          const regRes = await fetch('http://127.0.0.1:3001/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Carlos Original', email, password: oldPassword, country: 'ES' })
          });
          const regData = await regRes.json();
          if (!regData.token) throw new Error('Falha no registro: ' + JSON.stringify(regData));
          let token = regData.token;
          const userId = regData.user.id;
          console.log('   Usuário registrado ID:', userId);

          console.log('2. Consultando GET /api/v1/auth/me...');
          const meRes1 = await fetch('http://127.0.0.1:3001/api/v1/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const meData1 = await meRes1.json();
          if (meData1.name !== 'Carlos Original') throw new Error('Nome inicial incorreto: ' + meData1.name);
          console.log('   ✅ GET /auth/me OK: Nome:', meData1.name, 'País:', meData1.country || meData1.country_code);

          console.log('3. Atualizando perfil com PUT /api/v1/auth/me...');
          const updRes = await fetch('http://127.0.0.1:3001/api/v1/auth/me', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
              name: 'Carlos Trader Atualizado',
              country: 'BR',
              phone_code: '+55',
              phone_number: '11988887777'
            })
          });
          const updData = await updRes.json();
          if (!updData.success || !updData.token) throw new Error('Falha no update profile: ' + JSON.stringify(updData));
          token = updData.token;
          console.log('   ✅ PUT /auth/me OK: Novo token recebido, Nome:', updData.user.name);

          console.log('4. Verificando persistência no PostgreSQL via novo GET /auth/me...');
          const meRes2 = await fetch('http://127.0.0.1:3001/api/v1/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const meData2 = await meRes2.json();
          if (meData2.name !== 'Carlos Trader Atualizado') throw new Error('Nome não persistiu no banco: ' + meData2.name);
          if (meData2.phone_number !== '11988887777') throw new Error('Telefone não persistiu: ' + meData2.phone_number);
          console.log('   ✅ Persistência no PostgreSQL confirmada: Telefone:', meData2.phone_number, 'País:', meData2.country || meData2.country_code);

          console.log('5. Teste de Segurança Anti-Mass-Assignment (Invariante I-01): Tentativa de forjar saldo via perfil...');
          const hackRes = await fetch('http://127.0.0.1:3001/api/v1/auth/me', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
              name: 'Tentativa Hacker',
              demo_balance_minor: 999999999,
              balance: 999999999
            })
          });
          const hackData = await hackRes.json();
          const meRes3 = await fetch('http://127.0.0.1:3001/api/v1/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const meData3 = await meRes3.json();
          if (meData3.demo_balance_minor !== 1000000) {
            throw new Error('VIOLAÇÃO GRAVE: Saldo foi modificado via payload de perfil! Saldo: ' + meData3.demo_balance_minor);
          }
          console.log('   ✅ Invariante I-01 inviolável: saldo permaneceu 1000000!');

          console.log('6. Atualizando senha com PUT /api/v1/auth/password...');
          const passRes = await fetch('http://127.0.0.1:3001/api/v1/auth/password', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
              current_password: oldPassword,
              new_password: newPassword
            })
          });
          const passData = await passRes.json();
          if (!passData.success) throw new Error('Falha ao atualizar senha: ' + JSON.stringify(passData));
          console.log('   ✅ PUT /auth/password OK:', passData.message);

          console.log('7. Verificando que a senha antiga foi revogada no login...');
          const oldLoginRes = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: oldPassword })
          });
          if (oldLoginRes.status !== 401) throw new Error('Senha antiga deveria retornar 401, retornou: ' + oldLoginRes.status);
          console.log('   ✅ Senha antiga rejeitada corretamente (401)!');

          console.log('8. Testando login com a nova senha...');
          const newLoginRes = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: newPassword })
          });
          if (newLoginRes.status !== 200) throw new Error('Login com nova senha falhou: ' + newLoginRes.status);
          const newLoginData = await newLoginRes.json();
          if (!newLoginData.token) throw new Error('Novo login não retornou token');
          console.log('   ✅ Login com nova senha efetuado com sucesso!');

          console.log('🎉 SUBETAPA 02 CERTIFICADA COM 100% DE SUCESSO!');
          process.exit(0);
        } catch (e) {
          console.error('❌ ERRO NO TESTE:', e.message);
          process.exit(1);
        }
      })();
    "
  `;

  console.log('Executando teste automatizado de Perfil e Senha na VPS...');
  conn.exec(testScript, (err, testProc) => {
    if (err) throw err;
    testProc.on('data', d => process.stdout.write(d));
    testProc.stderr.on('data', d => process.stderr.write(d));
    testProc.on('close', code => {
      conn.end();
      process.exit(code);
    });
  });
}).connect({ host: VPS_HOST, port: 22, username: VPS_USER, password: VPS_PASS });
