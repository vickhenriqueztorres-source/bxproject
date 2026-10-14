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
  console.log('🚀 CERTIFICAÇÃO AO VIVO — ETAPA 5: MÓDULOS SECUNDÁRIOS REAIS');
  console.log('Submódulos: KYC / Verificação, Torneios Institucionais e Promoções');
  console.log('Ambiente: Produção (https://binmaxbroker.com)');
  console.log('================================================================\n');

  const testEmail = `trader_sec_${Date.now()}@binmax.test`;
  const testPassword = `Pass#Sec${Date.now()}!`;
  const testName = 'Trader Certificação Módulos Secundários';

  // ─── 1. VERIFICAR ROTAS E ASSETS EM PRODUÇÃO ─────────────────────────────
  console.log('--- 1. Verificando Rota e Disponibilidade da Plataforma ---');
  const landingRes = await fetch(`${BASE_URL}/`);
  if (!landingRes.ok) throw new Error(`HTTP ${landingRes.status} ao acessar a raiz`);
  console.log(`✅ Plataforma online com HTTP ${landingRes.status} OK.`);

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
      phone: '+5511999998888',
    }),
  });
  const regData = await regRes.json();
  if (!regRes.ok || !regData.token) {
    throw new Error(`Falha no registro: HTTP ${regRes.status} - ${JSON.stringify(regData)}`);
  }
  const token = regData.token;
  const userId = regData.user.id;
  console.log(`✅ Usuário registrado com sucesso: ID=${userId}, Email=${regData.user.email}`);

  // ─── 3. TESTE DE SEGURANÇA E NÃO-AUTENTICADOS (401) ──────────────────────
  console.log('\n--- 3. Verificando Proteção de Autorização (401 para requisições anônimas) ---');
  const unauthKyc = await fetch(`${BASE_URL}/api/v1/kyc/status`);
  if (unauthKyc.status !== 401) throw new Error(`Esperado 401 para KYC anônimo, obtido ${unauthKyc.status}`);
  console.log('✅ GET /api/v1/kyc/status sem token retorna 401 Unauthorized.');

  const unauthJoin = await fetch(`${BASE_URL}/api/v1/tournaments/copa-binmax/join`, { method: 'POST' });
  if (unauthJoin.status !== 401) throw new Error(`Esperado 401 para join anônimo, obtido ${unauthJoin.status}`);
  console.log('✅ POST /api/v1/tournaments/:id/join sem token retorna 401 Unauthorized.');

  const unauthPromo = await fetch(`${BASE_URL}/api/v1/promotions/promo-cashback/activate`, { method: 'POST' });
  if (unauthPromo.status !== 401) throw new Error(`Esperado 401 para ativação anônima, obtido ${unauthPromo.status}`);
  console.log('✅ POST /api/v1/promotions/:id/activate sem token retorna 401 Unauthorized.');

  // ─── 4. SUBMÓDULO KYC REAL ───────────────────────────────────────────────
  console.log('\n--- 4. Testando Módulo KYC Real ---');
  const kycStatusInitRes = await fetch(`${BASE_URL}/api/v1/kyc/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const kycStatusInit = await kycStatusInitRes.json();
  console.log(`✅ Status KYC Inicial: identity=${kycStatusInit.identity_status}, address=${kycStatusInit.address_status}`);

  console.log('Submetendo documento oficial de identidade...');
  const kycSubmitRes = await fetch(`${BASE_URL}/api/v1/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      category: 'identity',
      file_name: 'passaporte_live_test.pdf',
      document_type: 'PASSPORT',
      document_number: 'BR-889900',
    }),
  });
  const kycSubmitData = await kycSubmitRes.json();
  if (!kycSubmitRes.ok || !kycSubmitData.success) {
    throw new Error(`Falha no envio de KYC: ${JSON.stringify(kycSubmitData)}`);
  }
  console.log(`✅ Envio de KYC aceito pela API: identity_status=${kycSubmitData.identity_status}`);

  // Consulta status atualizado via API
  const kycStatusAfterRes = await fetch(`${BASE_URL}/api/v1/kyc/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const kycStatusAfter = await kycStatusAfterRes.json();
  if (kycStatusAfter.identity_status !== 'IN_REVIEW') {
    throw new Error(`Esperado identity_status IN_REVIEW, recebido ${kycStatusAfter.identity_status}`);
  }
  console.log(`✅ Consulta API confirmou: identity_status=${kycStatusAfter.identity_status}, arquivo=${kycStatusAfter.uploaded_files?.[0]?.name}`);

  // Prova física no PostgreSQL
  console.log('Consultando persistência física em broker_platform.kyc_profiles via SSH...');
  const sqlKyc = `SELECT user_id, identity_status, address_status, document_type, uploaded_files FROM kyc_profiles WHERE user_id = '${userId}';`;
  const kycDbOut = await runSshQuery(sqlKyc);
  console.log(kycDbOut.trim());
  if (!kycDbOut.includes(userId) || !kycDbOut.includes('IN_REVIEW')) {
    throw new Error('Registro físico não localizado em kyc_profiles!');
  }
  console.log('✅ KYC gravado com integridade física no PostgreSQL!');

  // ─── 5. SUBMÓDULO TORNEIOS INSTITUCIONAIS REAIS ──────────────────────────
  console.log('\n--- 5. Testando Módulo de Torneios Institucionais ---');
  const tourListRes = await fetch(`${BASE_URL}/api/v1/tournaments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tourList = await tourListRes.json();
  if (!Array.isArray(tourList) || tourList.length === 0) {
    throw new Error(`Lista de torneios vazia ou inválida: ${JSON.stringify(tourList)}`);
  }
  const copa = tourList.find((t) => t.id === 'copa-binmax');
  if (!copa) throw new Error('Torneio copa-binmax não encontrado na listagem!');
  console.log(`✅ Lista de torneios retornou ${tourList.length} evento(s). Torneio: ${copa.name}, status=${copa.status}, participantes=${copa.participants}`);
  console.log(`✅ Estado de inscrição inicial para este usuário: userJoined=${copa.userJoined}`);

  console.log('Executando inscrição no torneio copa-binmax...');
  const joinRes = await fetch(`${BASE_URL}/api/v1/tournaments/copa-binmax/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const joinData = await joinRes.json();
  if (!joinRes.ok || !joinData.success || !joinData.joined) {
    throw new Error(`Falha na inscrição: ${JSON.stringify(joinData)}`);
  }
  console.log(`✅ Inscrição aceita pela API: tournament_id=${joinData.tournament_id}, joined=${joinData.joined}`);

  // Consulta lista novamente para verificar userJoined
  const tourListAfterRes = await fetch(`${BASE_URL}/api/v1/tournaments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tourListAfter = await tourListAfterRes.json();
  const copaAfter = tourListAfter.find((t) => t.id === 'copa-binmax');
  if (!copaAfter || !copaAfter.userJoined) {
    throw new Error('userJoined não refletido na consulta de torneios após inscrição!');
  }
  console.log(`✅ Consulta API confirmou: copa-binmax agora possui userJoined=true e participantes=${copaAfter.participants}`);

  // Prova física no PostgreSQL
  console.log('Consultando persistência física em broker_platform.tournament_participants via SSH...');
  const sqlTour = `SELECT tournament_id, user_id, joined_at FROM tournament_participants WHERE tournament_id = 'copa-binmax' AND user_id = '${userId}';`;
  const tourDbOut = await runSshQuery(sqlTour);
  console.log(tourDbOut.trim());
  if (!tourDbOut.includes('copa-binmax') || !tourDbOut.includes(userId)) {
    throw new Error('Registro físico não localizado em tournament_participants!');
  }
  console.log('✅ Inscrição gravada com integridade física no PostgreSQL!');

  // ─── 6. SUBMÓDULO PROMOÇÕES REAIS ────────────────────────────────────────
  console.log('\n--- 6. Testando Módulo de Promoções Reais ---');
  const promoListRes = await fetch(`${BASE_URL}/api/v1/promotions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const promoList = await promoListRes.json();
  if (!Array.isArray(promoList) || promoList.length === 0) {
    throw new Error(`Lista de promoções vazia ou inválida: ${JSON.stringify(promoList)}`);
  }
  const cashbackPromo = promoList.find((p) => p.id === 'promo-cashback');
  if (!cashbackPromo) throw new Error('Promoção promo-cashback não encontrada!');
  console.log(`✅ Lista de promoções retornou ${promoList.length} programa(s). Cashback isActive=${cashbackPromo.isActive}`);

  console.log('Ativando programa promo-cashback...');
  const activateRes = await fetch(`${BASE_URL}/api/v1/promotions/promo-cashback/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const activateData = await activateRes.json();
  if (!activateRes.ok || !activateData.success) {
    throw new Error(`Falha na ativação de promoção: ${JSON.stringify(activateData)}`);
  }
  console.log(`✅ Ativação aceita pela API: promo_id=${activateData.promo_id}, status=${activateData.status}`);

  // Consulta lista novamente
  const promoListAfterRes = await fetch(`${BASE_URL}/api/v1/promotions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const promoListAfter = await promoListAfterRes.json();
  const cashbackAfter = promoListAfter.find((p) => p.id === 'promo-cashback');
  if (!cashbackAfter || !cashbackAfter.isActive) {
    throw new Error('isActive não refletido na consulta de promoções após ativação!');
  }
  console.log(`✅ Consulta API confirmou: promo-cashback agora possui isActive=true`);

  // Prova física no PostgreSQL
  console.log('Consultando persistência física em broker_platform.user_promotions via SSH...');
  const sqlPromo = `SELECT user_id, promo_id, status, activated_at FROM user_promotions WHERE user_id = '${userId}' AND promo_id = 'promo-cashback';`;
  const promoDbOut = await runSshQuery(sqlPromo);
  console.log(promoDbOut.trim());
  if (!promoDbOut.includes(userId) || !promoDbOut.includes('promo-cashback') || !promoDbOut.includes('ACTIVE')) {
    throw new Error('Registro físico não localizado em user_promotions!');
  }
  console.log('✅ Ativação gravada com integridade física no PostgreSQL!');

  console.log('\n================================================================');
  console.log('🏆 ETAPA 5 — CERTIFICAÇÃO 100% HOMOLOGADA AO VIVO EM PRODUÇÃO!');
  console.log('Todos os 12 critérios de conformidade, banco de dados e APIs foram validados.');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n❌ ERRO NA CERTIFICAÇÃO DA ETAPA 5:', err);
  process.exit(1);
});
