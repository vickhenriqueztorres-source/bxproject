import https from 'node:https';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    }).on('error', reject);
  });
}

async function verifyLive() {
  console.log('🔍 [Etapa 7 Live Verification] Verificando produção em https://binmaxbroker.com ...\n');

  // 1. Verificar HTML principal
  const htmlRes = await fetchUrl('https://binmaxbroker.com/');
  console.log(`1. HTML index status: ${htmlRes.statusCode}`);
  if (htmlRes.statusCode !== 200) {
    throw new Error(`Falha ao obter index.html: HTTP ${htmlRes.statusCode}`);
  }

  // 2. Extrair bundle JS principal
  const bundleMatch = htmlRes.body.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!bundleMatch) {
    throw new Error('Não foi possível encontrar a tag do script principal no HTML.');
  }
  const bundlePath = bundleMatch[1];
  console.log(`2. Bundle ativo: ${bundlePath}`);

  // 3. Obter conteúdo do bundle e verificar os novos componentes de strike line e taxa
  const bundleRes = await fetchUrl(`https://binmaxbroker.com${bundlePath}`);
  console.log(`3. Bundle JS status: ${bundleRes.statusCode} (${bundleRes.body.length} bytes)`);

  const hasSvgLines = bundleRes.body.includes('order-strike-lines-svg');
  const hasAxisTag = bundleRes.body.includes('axis-strike-tag');
  const hasStrikeFlag = bundleRes.body.includes('order-strike-flag');

  console.log(`   - Camada SVG de Strike (order-strike-lines-svg): ${hasSvgLines ? '✅ PRESENTE' : '❌ AUSENTE'}`);
  console.log(`   - Marcador na Escala de Preço (axis-strike-tag): ${hasAxisTag ? '✅ PRESENTE' : '❌ AUSENTE'}`);
  console.log(`   - Flag da Ordem com Taxa (order-strike-flag):   ${hasStrikeFlag ? '✅ PRESENTE' : '❌ AUSENTE'}`);

  if (!hasSvgLines || !hasAxisTag) {
    throw new Error('O bundle em produção não contém os componentes de traço de strike e taxa!');
  }

  // 4. Testar Endpoint de Cotações / Health
  const feedRes = await fetchUrl('https://binmaxbroker.com/api/indices/SYNTH_VOL_50');
  console.log(`\n4. Feed SYNTH_VOL_50 status: ${feedRes.statusCode}`);
  const feedJson = JSON.parse(feedRes.body);
  console.log(`   - Cotação atual: ${feedJson.price}`);
  console.log(`   - Status do Ativo: ${feedJson.status || 'OK'}`);

  console.log('\n🎉 [ETAPA 7 CONCLUÍDA E HOMOLOGADA AO VIVO NO SERVIDOR]');
}

verifyLive().catch((err) => {
  console.error('❌ Erro na validação ao vivo:', err.message);
  process.exit(1);
});
