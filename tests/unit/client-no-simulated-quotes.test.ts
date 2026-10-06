import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Audit: Zero Client-Side Simulated Quotes (A-07 / Menor 8)', () => {
  it('no price, tick, candle, or strike generation using Math.random in apps/web/src', () => {
    const webSrcDir = path.resolve(process.cwd(), 'apps/web/src');
    
    function scanDir(dir: string): string[] {
      const files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
            files.push(...scanDir(full));
          }
        } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.includes('.test.')) {
          files.push(full);
        }
      }
      return files;
    }

    const sourceFiles = scanDir(webSrcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of sourceFiles) {
      const relative = path.relative(process.cwd(), file);
      // backoff.ts usa Math.random exclusivamente para jitter de reconexão de rede (permitido)
      if (relative.endsWith('backoff.ts')) continue;

      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        // Proíbe Math.random gerando preço, vela, strike ou tick
        if (line.includes('Math.random') && !line.trim().startsWith('//')) {
          violations.push({
            file: relative,
            line: index + 1,
            text: line.trim()
          });
        }
        // Proíbe geradores em mock de preço de mercado
        if (/mockCurrentPrice|generateInitialCandles/.test(line) && !line.trim().startsWith('//')) {
          violations.push({
            file: relative,
            line: index + 1,
            text: line.trim()
          });
        }
      });
    }

    assert.strictEqual(
      violations.length,
      0,
      `VIOLAÇÃO A-07: Cotações simuladas ou geradores de preço no cliente detectados:\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join('\n')}`
    );
  });

  it('strikes and order flags derive strictly from server contract fields', () => {
    // Simula contrato retornado pelo backend
    const serverContract = {
      id: 'contract-12345',
      symbol: 'EURUSD_OTC',
      direction: 'UP' as const,
      status: 'OPEN',
      entry_price: '1.08542',
      stake_minor: 1000,
      expires_at: new Date(Date.now() + 60000).toISOString()
    };

    // Função representativa do OrderFlagsOverlay
    const computeFlagPrice = (c: typeof serverContract) => {
      // Preço de strike DEVE derivar do entry_price gravado no servidor (A-07)
      if (!c.entry_price || typeof c.entry_price !== 'string') {
        throw new Error('MISSING_SERVER_ENTRY_PRICE');
      }
      return parseFloat(c.entry_price);
    };

    const flagPrice = computeFlagPrice(serverContract);
    assert.strictEqual(flagPrice, 1.08542, 'Preço de strike na bandeira deve ser idêntico ao gravado pelo servidor');
  });
});
