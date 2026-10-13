import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { RegionalMetricsService } from '../services/api/dist/services/metrics.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 7: Monitoramento Prometheus, Métricas e Alertas Regionais');

// 1. Verificação do Arquivo de Alertas do Alertmanager
const alertRulesFile = path.resolve('infra/prometheus/phase2_alerts.yml');
assert(fs.existsSync(alertRulesFile), 'Arquivo de alertas infra/prometheus/phase2_alerts.yml deve existir');

const alertYaml = fs.readFileSync(alertRulesFile, 'utf-8');
const expectedAlerts = ['HighGeoblockRejectionRate', 'OtcFeedCircuitBreakerOpen', 'CountryFeatureFlagDisabled'];

for (const alert of expectedAlerts) {
  assert(alertYaml.includes(alert), `Regra de alerta '${alert}' deve estar configurada no Prometheus`);
}
console.log('  ✅ [PASS] Arquivo de alertas phase2_alerts.yml validado com 3 regras regionais críticas');

// 2. Verificação de Emissão OpenMetrics do RegionalMetricsService
const metrics = RegionalMetricsService.getInstance();
metrics.incrementRequest('BR', '/api/v1/contracts', 200);
metrics.incrementGeoblockRejection('US', 'UNSUPPORTED_REGION');
metrics.setFlagStatus('MX', 'trading_enabled', true);
metrics.setOtcFeedStatus('BTCUSD_OTC', 'CLOSED', 15);

const rendered = metrics.renderOpenMetrics();
assert(rendered.includes('broker_http_requests_total'), 'Métrica broker_http_requests_total deve ser emitida');
assert(rendered.includes('broker_geoblock_rejections_total'), 'Métrica broker_geoblock_rejections_total deve ser emitida');
assert(rendered.includes('broker_feature_flags_status'), 'Métrica broker_feature_flags_status deve ser emitida');
assert(rendered.includes('broker_otc_real_feed_status'), 'Métrica broker_otc_real_feed_status deve ser emitida');
console.log('  ✅ [PASS] Coleta e formatação de todas as séries temporais da Fase 2 comprovadas');

// 3. Verificação de Proteção contra Cardinalidade Excessiva
metrics.incrementRequest('HACK_INJECTION_VERY_LONG', '/evil', 400);
const sanitizedRender = metrics.renderOpenMetrics();
assert(sanitizedRender.includes('country="UNKNOWN"'), 'País malformado deve ser mapeado para UNKNOWN');
console.log('  ✅ [PASS] Proteção contra Cardinality Explosion no Prometheus atestada');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 7 (GATE-F2-07) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
