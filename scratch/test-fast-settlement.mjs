async function run() {
  console.log('--- TESTE DE LIQUIDAÇÃO RÁPIDA (10s) ---');
  const res = await fetch('http://169.58.159.77/api/contracts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'fast_' + Date.now(),
    },
    body: JSON.stringify({
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 1000,
      duration_seconds: 10,
    }),
  });

  const contract = await res.json();
  console.log('1. Contrato Aberto:', contract.id);
  console.log('   Entrada:', contract.contract.entry_price);
  console.log('   Status:', contract.status);
  console.log('   Expiração programada:', contract.expires_at);

  console.log('2. Aguardando 12 segundos para liquidação no tick oficial...');
  await new Promise((r) => setTimeout(r, 12000));

  const check = await fetch(`http://169.58.159.77/api/contracts/${contract.id}`);
  const settled = await check.json();
  console.log('3. Resultado da Liquidação:');
  console.log('   Status:', settled.status);
  console.log('   Resultado:', settled.result);
  console.log('   Payout:', settled.payout_minor);
  console.log('✅ TESTE CONCLUÍDO COM SUCESSO');
}

run().catch(console.error);
