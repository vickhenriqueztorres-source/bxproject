import { Client } from 'ssh2';

const BASE_URL = 'https://binmaxbroker.com';
const VPS_HOST = '169.58.159.77';
const VPS_USER = 'root';
const VPS_PASS = 'NqBxE5RrCwSd';

async function runSshQuery(sql) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      const dockerCmd = `docker exec -i broker-postgres psql -U synth_migrator -d broker_platform -c "${sql}"`;
      conn.exec(dockerCmd, (err, stream) => {
        if (err) return reject(err);
        let output = '';
        let errOut = '';
        stream.on('data', (d) => { output += d.toString(); });
        stream.stderr.on('data', (d) => { errOut += d.toString(); });
        stream.on('close', () => {
          conn.end();
          if (errOut && !output) {
            console.error('[PSQL Error]', errOut);
          }
          resolve(output);
        });
      });
    });
    conn.on('error', reject);
    conn.connect({
      host: VPS_HOST,
      port: 22,
      username: VPS_USER,
      password: VPS_PASS,
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('🚀 CERTIFICAÇÃO AO VIVO — ETAPA 4: FLUXOS FINANCEIROS DE DEPÓSITO E SAQUE');
  console.log('Ambiente: Produção (https://binmaxbroker.com)');
  console.log('================================================================\n');

  const testEmail = `trader_cashier_${Date.now()}@binmax.test`;
  const testPassword = `Pass#Cashier${Date.now()}!`;
  const testName = 'Trader Certificação Cashier';

  // ─── 1. VERIFICAR ASSETS ATUALIZADOS ──────────────────────────────────────
  console.log('--- 1. Verificando Entrega dos Novos Assets em Produção ---');
  const landingRes = await fetch(`${BASE_URL}/`);
  if (!landingRes.ok) throw new Error(`HTTP ${landingRes.status} ao acessar a raiz`);
  const landingHtml = await landingRes.text();
  if (landingHtml.includes('index-B2Q5rKY5.js')) {
    console.log('✅ Bundle novo (index-B2Q5rKY5.js) ativo no HTML raiz.');
  }
  console.log(`✅ Landing Page HTTP ${landingRes.status} OK.`);

  // ─── 2. CADASTRO DE USUÁRIO REAL ─────────────────────────────────────────
  console.log('\n--- 2. Cadastrando Usuário Real via API ---');
  const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: testName,
      country: 'BR',
      phone: '+5511988887777',
    }),
  });
  const regData = await regRes.json();
  if (!regRes.ok || !regData.token) {
    throw new Error(`Falha no registro: HTTP ${regRes.status} - ${JSON.stringify(regData)}`);
  }
  const token = regData.token;
  const userId = regData.user.id;
  const initialBal = regData.user.demo_balance_minor ?? regData.user.demoBalanceMinor ?? 1000000;
  console.log(`✅ Usuário registrado com sucesso: ID=${userId}, Email=${regData.user.email}`);
  console.log(`✅ Saldo Demo Inicial: $${(initialBal / 100).toFixed(2)} (${initialBal} minor)`);

  // ─── 3. LOGIN REAL ────────────────────────────────────────────────────────
  console.log('\n--- 3. Efetuando Login Real via API ---');
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Falha no login: HTTP ${loginRes.status} - ${JSON.stringify(loginData)}`);
  }
  console.log('✅ Login autenticado com sucesso.');

  // ─── 4. CARTEIRA INICIAL ──────────────────────────────────────────────────
  console.log('\n--- 4. Consultando Saldo Inicial da Carteira ---');
  const walletRes = await fetch(`${BASE_URL}/api/v1/wallet`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const walletData = await walletRes.json();
  if (!walletRes.ok || walletData.available_minor !== 1000000) {
    throw new Error(`Saldo inicial incorreto: ${JSON.stringify(walletData)}`);
  }
  console.log(`✅ Carteira: Disponível = $${(walletData.available_minor / 100).toFixed(2)} (${walletData.available_minor} minor)`);

  // ─── 5. SOLICITAÇÃO REAL DE DEPÓSITO (POST /api/v1/wallet/deposit) ────────
  console.log('\n--- 5. Solicitando Depósito Real via PIX ($150.00) ---');
  const depositAmountMinor = 15000; // $150.00
  const depRes = await fetch(`${BASE_URL}/api/v1/wallet/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': `idem-dep-cert-${Date.now()}`,
    },
    body: JSON.stringify({
      amount_minor: depositAmountMinor,
      method: 'PIX',
    }),
  });
  const depData = await depRes.json();
  if (!depRes.ok || !depData.transaction?.id) {
    throw new Error(`Falha ao criar depósito: HTTP ${depRes.status} - ${JSON.stringify(depData)}`);
  }
  const depTxId = depData.transaction.id;
  console.log(`✅ Intenção de Depósito Criada com Sucesso!`);
  console.log(`   ID da Transação: ${depTxId}`);
  console.log(`   Método: ${depData.transaction.method}`);
  console.log(`   Valor: $${(depData.transaction.amount_minor / 100).toFixed(2)} (${depData.transaction.amount_minor} minor)`);
  console.log(`   Status: ${depData.transaction.status}`);
  console.log(`   Código PIX: ${depData.transaction.pix_code.slice(0, 35)}...`);

  // ─── 6. AUDITORIA DE DEPÓSITO NO POSTGRESQL ───────────────────────────────
  console.log('\n--- 6. Auditando Transação de Depósito no PostgreSQL (broker-postgres) ---');
  const dbDepResult = await runSshQuery(`SELECT id, user_id, type, method, amount_minor, status FROM wallet_transactions WHERE id = '${depTxId}';`);
  console.log(dbDepResult.trim());
  if (!dbDepResult.includes(depTxId) || !dbDepResult.includes('PENDING') || !dbDepResult.includes('15000')) {
    throw new Error(`FALHA CRÍTICA: Transação de depósito ${depTxId} não encontrada como PENDING no PostgreSQL!`);
  }
  console.log('✅ PROVA INVIOLÁVEL: Transação de depósito registrada no banco de dados com status PENDING!');

  // ─── 7. CONFIRMAÇÃO DO DEPÓSITO ───────────────────────────────────────────
  console.log('\n--- 7. Confirmando Pagamento do Depósito (POST /api/v1/wallet/deposit/confirm) ---');
  const confRes = await fetch(`${BASE_URL}/api/v1/wallet/deposit/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ transaction_id: depTxId }),
  });
  const confData = await confRes.json();
  if (!confRes.ok || confData.status !== 'COMPLETED') {
    throw new Error(`Falha ao confirmar depósito: HTTP ${confRes.status} - ${JSON.stringify(confData)}`);
  }
  console.log(`✅ Depósito Confirmado com Sucesso! Novo Saldo: $${(confData.new_balance_minor / 100).toFixed(2)} (${confData.new_balance_minor} minor)`);
  if (confData.new_balance_minor !== 1015000) {
    throw new Error(`Saldo pós-depósito incorreto! Esperado: 1015000, Recebido: ${confData.new_balance_minor}`);
  }

  // Auditoria pós-confirmação no PostgreSQL
  const dbDepPostResult = await runSshQuery(`SELECT id, status FROM wallet_transactions WHERE id = '${depTxId}';`);
  console.log('Status da transação no PostgreSQL após confirmação:');
  console.log(dbDepPostResult.trim());
  if (!dbDepPostResult.includes('COMPLETED')) {
    throw new Error(`Transação ${depTxId} não foi atualizada para COMPLETED no banco!`);
  }

  // ─── 8. SOLICITAÇÃO REAL DE SAQUE ($50.00) ────────────────────────────────
  console.log('\n--- 8. Solicitando Saque Real via PIX ($50.00) ---');
  const withdrawAmountMinor = 5000; // $50.00
  const pixKey = 'trader_cert_key@banco.com';
  const withRes = await fetch(`${BASE_URL}/api/v1/wallet/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': `idem-wth-cert-${Date.now()}`,
    },
    body: JSON.stringify({
      amount_minor: withdrawAmountMinor,
      method: 'PIX',
      destination_account: pixKey,
    }),
  });
  const withData = await withRes.json();
  if (!withRes.ok || !withData.transaction?.id) {
    throw new Error(`Falha ao solicitar saque: HTTP ${withRes.status} - ${JSON.stringify(withData)}`);
  }
  const withTxId = withData.transaction.id;
  console.log(`✅ Saque Solicitado com Sucesso!`);
  console.log(`   ID da Transação: ${withTxId}`);
  console.log(`   Método: ${withData.transaction.method}`);
  console.log(`   Valor Retirado: $${(withData.transaction.amount_minor / 100).toFixed(2)} (${withData.transaction.amount_minor} minor)`);
  console.log(`   Destino: ${withData.transaction.destination_account}`);
  console.log(`   Novo Saldo: $${(withData.new_balance_minor / 100).toFixed(2)} (${withData.new_balance_minor} minor)`);
  if (withData.new_balance_minor !== 1010000) {
    throw new Error(`Saldo pós-saque incorreto! Esperado: 1010000, Recebido: ${withData.new_balance_minor}`);
  }

  // ─── 9. AUDITORIA DE SAQUE NO POSTGRESQL ──────────────────────────────────
  console.log('\n--- 9. Auditando Saque e Débito no PostgreSQL (broker-postgres) ---');
  const dbWithResult = await runSshQuery(`SELECT id, type, method, amount_minor, status, destination_account FROM wallet_transactions WHERE id = '${withTxId}';`);
  console.log(dbWithResult.trim());
  if (!dbWithResult.includes(withTxId) || !dbWithResult.includes('WITHDRAWAL') || !dbWithResult.includes('5000')) {
    throw new Error(`Transação de saque ${withTxId} não encontrada no PostgreSQL!`);
  }
  const dbUserResult = await runSshQuery(`SELECT id, demo_balance_minor FROM users WHERE id = '${userId}';`);
  console.log('Saldo do usuário no PostgreSQL após débito:');
  console.log(dbUserResult.trim());
  if (!dbUserResult.includes('1010000')) {
    throw new Error(`Saldo no PostgreSQL não reflete a dedução atômica! Esperado: 1010000`);
  }
  console.log('✅ PROVA INVIOLÁVEL: Saque auditado no PostgreSQL com débito atômico exato!');

  // ─── 10. TESTE DE SEGURANÇA: SAQUE ACIMA DO SALDO (I-01/I-04) ─────────────
  console.log('\n--- 10. Testando Proteção Contra Saldo Negativo (Saque Excessivo de $500,000.00) ---');
  const overdrawRes = await fetch(`${BASE_URL}/api/v1/wallet/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': `idem-overdraw-${Date.now()}`,
    },
    body: JSON.stringify({
      amount_minor: 50000000, // $500,000.00 (acima do saldo)
      method: 'PIX',
      destination_account: pixKey,
    }),
  });
  const overdrawData = await overdrawRes.json();
  if (overdrawRes.status !== 400 || overdrawData.error !== 'INSUFFICIENT_FUNDS') {
    throw new Error(`Falha de segurança! API deveria rejeitar com 400 INSUFFICIENT_FUNDS: HTTP ${overdrawRes.status} - ${JSON.stringify(overdrawData)}`);
  }
  console.log('✅ APROVADO: Saque excessivo bloqueado com HTTP 400 INSUFFICIENT_FUNDS e saldo protegido.');

  // ─── 11. CONSULTA AO EXTRATO DE TRANSAÇÕES (GET /api/v1/wallet/transactions) ──
  console.log('\n--- 11. Consultando Extrato Financeiro Real (GET /api/v1/wallet/transactions) ---');
  const txListRes = await fetch(`${BASE_URL}/api/v1/wallet/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const txListData = await txListRes.json();
  if (!txListRes.ok || !Array.isArray(txListData)) {
    throw new Error(`Falha ao listar transações: HTTP ${txListRes.status}`);
  }
  console.log(`✅ Extrato retornado com ${txListData.length} transações auditáveis:`);
  for (const t of txListData) {
    console.log(`   [${t.type}] ID=${t.id.slice(0, 8)}... | Método=${t.method} | Valor=$${(t.amount_minor / 100).toFixed(2)} | Status=${t.status}`);
  }
  if (!txListData.some(t => t.id === depTxId) || !txListData.some(t => t.id === withTxId)) {
    throw new Error('As transações recém-criadas não constam no extrato financeiro do usuário!');
  }

  console.log('\n================================================================');
  console.log('🎉 CERTIFICAÇÃO AO VIVO DA ETAPA 4 100% APROVADA COM SUCESSO!');
  console.log('1. Depósito real criado e auditado no PostgreSQL (wallet_transactions)');
  console.log('2. Confirmação e crédito atômico validados ($10,000.00 -> $10,150.00)');
  console.log('3. Saque real com débito atômico e proteção de saldo ($10,150.00 -> $10,100.00)');
  console.log('4. Bloqueio rigoroso de saldo insuficiente (HTTP 400 INSUFFICIENT_FUNDS)');
  console.log('5. Extrato financeiro unificado conectado e validado');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n❌ ERRO NA CERTIFICAÇÃO:', err);
  process.exit(1);
});
