import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pt = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'apps', 'web', 'src', 'i18n', 'locales', 'pt-BR.json'), 'utf8')
);
const es = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'apps', 'web', 'src', 'i18n', 'locales', 'es-ES.json'), 'utf8')
);

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

function flattenValues(obj) {
  const vals = [];
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      vals.push(...flattenValues(v));
    } else if (typeof v === 'string') {
      vals.push(v);
    }
  }
  return vals;
}

describe('Subetapa 7.4 — Prevencao de Vazamento de Idioma (Language Leakage)', () => {
  it('possui exatamente as mesmas chaves nos catalogos PT e ES', () => {
    const ptKeys = flattenKeys(pt);
    const esKeys = flattenKeys(es);
    assert.deepEqual(ptKeys, esKeys, 'Catalogos PT e ES devem possuir as mesmas chaves');
  });

  it('catalogo PT nao contem palavras exclusivas em espanhol', () => {
    const ptValues = flattenValues(pt).join(' ');
    const spanishWords = ['¡Ganaste!', 'Perdiste', 'Venta', 'Sala Bronce', 'Sala Plata', 'Sala Oro'];

    for (const word of spanishWords) {
      assert.ok(
        !ptValues.includes(word),
        `Catalogo PT contem palavra em espanhol: ${word}`
      );
    }
  });

  it('catalogo ES nao contem palavras exclusivas em portugues', () => {
    const esValues = flattenValues(es).join(' ');
    const portugueseWords = ['Você', 'ganhou', 'perdeu', 'Venda', 'Sala Bronze', 'Sala Prata', 'Sala Ouro'];

    for (const word of portugueseWords) {
      assert.ok(
        !esValues.includes(word),
        `Catalogo ES contem palavra em portugues: ${word}`
      );
    }
  });

  it('possui chaves de arena, result, contract, mood e error em ambos os catalogos', () => {
    const requiredArenaKeys = [
      'you',
      'volatilityIndex',
      'roomBronze',
      'roomSilver',
      'roomGold',
      'classic',
      'turbo',
    ];
    for (const key of requiredArenaKeys) {
      assert.ok(pt.arena?.[key], `Faltando arena.${key} no catalogo PT`);
      assert.ok(es.arena?.[key], `Faltando arena.${key} no catalogo ES`);
    }

    assert.equal(pt.result?.win, 'Você ganhou!');
    assert.equal(es.result?.win, '¡Ganaste!');
    assert.equal(pt.result?.loss, 'Você perdeu');
    assert.equal(es.result?.loss, 'Perdiste');
    assert.equal(pt.mood?.sell, 'Venda');
    assert.equal(es.mood?.sell, 'Venta');
  });

  it('App.tsx nao possui strings ¡Ganaste! ou Perdiste hardcoded', () => {
    const appContent = fs.readFileSync(path.join(ROOT, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
    assert.ok(!appContent.includes('¡Ganaste!'), 'App.tsx nao deve ter ¡Ganaste! hardcoded');
    assert.ok(!appContent.includes('Perdiste'), 'App.tsx nao deve ter Perdiste hardcoded');
  });
});
