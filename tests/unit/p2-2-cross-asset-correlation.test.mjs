import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/diag/cross-asset-correlation.mjs');

test('P2-2: scripts/diag/cross-asset-correlation.mjs mede 1440 velas de 1m nos 36 ativos (630 pares), valida |corr(VOL_100, EURUSD_OTC)| < 0.10 e zero correlação persistente >= 0.10 em duas janelas', async () => {
  assert.equal(fs.existsSync(SCRIPT_PATH), true, 'scripts/diag/cross-asset-correlation.mjs deve existir');

  const mod = await import('../../scripts/diag/cross-asset-correlation.mjs');
  assert.equal(typeof mod.runCrossAssetCorrelationReport, 'function');

  const report = await mod.runCrossAssetCorrelationReport({
    limit: 1440,
    threshold: 0.10,
    mode: 'engine',
  });

  assert.equal(report.assetsCount, 36, 'Devem ser analisados todos os 36 ativos do catálogo');
  assert.equal(report.totalPairs, 630, '36 ativos devem formar exatamente 630 pares únicos');
  assert.equal(report.limit, 1440);
  assert.ok(
    Math.abs(report.vol100EurUsdCorrelationWindow1) < 0.10,
    `|corr(VOL_100, EURUSD_OTC)| na janela de 1440m deve ser < 0.10 (obtido: ${report.vol100EurUsdCorrelationWindow1})`
  );
  assert.equal(
    report.persistentPairsAboveThreshold.length,
    0,
    `Nenhum par pode repetir |corr| >= 0.10 nas duas janelas de 1440m (encontrados: ${JSON.stringify(report.persistentPairsAboveThreshold)})`
  );
  assert.equal(report.verdict, 'PASS_NO_PERSISTENT_CORRELATION');
});
