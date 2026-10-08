const HOST = 'http://169.58.159.77';

async function testHttpEndpoints() {
  console.log('--- 1. Testando Endpoints HTTP ---');
  const res = await fetch(`${HOST}/api/candles?symbol=SYNTH_VOL_50&timeframe=1m&limit=5`);
  const data = await res.json();
  console.log(`✅ Candles HTTP Status: ${res.status}, Candles recebidas: ${data.length}`);

  const newsRes = await fetch(`${HOST}/api/news?limit=3`);
  const newsData = await newsRes.json();
  console.log(`✅ News HTTP Status: ${newsRes.status}, Notícias recebidas: ${newsData.length}`);
}

async function testOrderOpenings() {
  console.log('\n--- 2. Testando Abertura de Ordens nos 3 Modos de Expiração ---');

  const modes = [
    { mode: '1M_FIXED', label: '1 Minuto Corrido' },
    { mode: 'CANDLE_1M', label: 'Fim da Vela 1M' },
    { mode: 'CANDLE_5M', label: 'Fim da Vela 5M' },
  ];

  for (const item of modes) {
    const payload = {
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 1000,
      user_id: 'test-qa-verifier',
      expiry_mode: item.mode,
      duration_seconds: 60,
    };

    const res = await fetch(`${HOST}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `qa-test-${item.mode}-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    console.log(`\nModo: ${item.label} (${item.mode})`);
    console.log(`Status HTTP: ${res.status}`);
    console.log(`Contrato ID: ${body.contract?.id || body.id}`);
    console.log(`Created At: ${body.contract?.created_at || body.created_at}`);
    console.log(`Expires At: ${body.contract?.expires_at || body.expires_at}`);

    const createdAt = Date.parse(body.contract?.created_at || body.created_at);
    const expiresAt = Date.parse(body.contract?.expires_at || body.expires_at);
    const durationSeconds = (expiresAt - createdAt) / 1000;

    console.log(`Duração Calculada pelo Servidor: ${durationSeconds.toFixed(1)} segundos`);

    if (durationSeconds < 30) {
      throw new Error(`FALHA CRÍTICA: Duração de ${durationSeconds}s é menor que o piso de 30s!`);
    } else {
      console.log(`✅ APROVADO: Duração de ${durationSeconds.toFixed(1)}s respeita rigorosamente o piso de >= 30s.`);
    }
  }
}

async function main() {
  try {
    await testHttpEndpoints();
    await testOrderOpenings();
    console.log('\n========================================');
    console.log('🎉 TODOS OS TESTES AO VIVO PASSARAM COM SUCESSO!');
    console.log('========================================');
  } catch (err) {
    console.error('❌ Erro na validação ao vivo:', err);
    process.exit(1);
  }
}

main();
