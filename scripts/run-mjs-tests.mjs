#!/usr/bin/env node
// Runner multiplataforma (Windows / Linux / CI) para a suíte de testes .mjs (P1-3 - Opção B).
// Expande deterministicamente tests/*.test.mjs, tests/unit/*.test.mjs e scripts/**/*.test.mjs
// e executa `node --test` sobre todos os arquivos encontrados.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

function collectMjsTestFiles(dirPath, recursive = false) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (recursive && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        results.push(...collectMjsTestFiles(fullPath, true));
      }
    } else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

const files = [
  ...collectMjsTestFiles(path.join(REPO_ROOT, 'tests'), false),
  ...collectMjsTestFiles(path.join(REPO_ROOT, 'tests', 'unit'), false),
  ...collectMjsTestFiles(path.join(REPO_ROOT, 'scripts'), true),
];

if (files.length === 0) {
  console.error('[test:mjs] Nenhum arquivo .test.mjs encontrado!');
  process.exit(1);
}

const relativeFiles = files.map((f) => path.relative(REPO_ROOT, f));
console.log(`[test:mjs] Executando ${relativeFiles.length} arquivos .test.mjs via node --test...`);

const res = spawnSync(process.execPath, ['--test', ...relativeFiles], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  env: process.env,
});

process.exit(res.status ?? 1);
