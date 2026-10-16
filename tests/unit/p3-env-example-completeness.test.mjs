import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, '.env.example');

function walkSourceFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(fullPath));
    } else if (
      /\.(mjs|js|ts)$/.test(entry.name) &&
      !/\.test\.|\.spec\./.test(entry.name)
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

test('P3-2: todas as variáveis process.env.* lidas em scripts/ e services/ estão documentadas em .env.example com valor padrão e descrição', () => {
  const envExampleContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  const documentedKeys = new Set();

  for (const line of envExampleContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=/);
    if (match) {
      documentedKeys.add(match[1]);
    }
  }

  const sourceFiles = [
    ...walkSourceFiles(path.join(REPO_ROOT, 'scripts')),
    ...walkSourceFiles(path.join(REPO_ROOT, 'services')),
  ];

  const referencedKeys = new Set();
  for (const file of sourceFiles) {
    const src = fs.readFileSync(file, 'utf8');
    for (const match of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
      referencedKeys.add(match[1]);
    }
  }

  const missingKeys = [...referencedKeys].filter((k) => !documentedKeys.has(k)).sort();
  assert.deepEqual(
    missingKeys,
    [],
    `As seguintes variáveis process.env.* estão ausentes do .env.example: ${missingKeys.join(', ')}`
  );
});
