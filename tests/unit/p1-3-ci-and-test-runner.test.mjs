import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

test('P1-3: package.json define script test:mjs e script test executando test:unit e test:mjs', () => {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert.equal(typeof pkg.scripts?.['test:mjs'], 'string', 'package.json deve ter script test:mjs');
  assert.equal(typeof pkg.scripts?.['test'], 'string', 'package.json deve ter script test');
  assert.equal(
    pkg.scripts['test'].includes('test:unit') && pkg.scripts['test'].includes('test:mjs'),
    true,
    'script "test" deve rodar test:unit e test:mjs'
  );
});

test('P1-3: .github/workflows/ci.yml existe e executa instalação, typecheck, test:unit e test:mjs em PR', () => {
  const ciPath = path.join(REPO_ROOT, '.github/workflows/ci.yml');
  assert.equal(fs.existsSync(ciPath), true, '.github/workflows/ci.yml deve existir');

  const ciContent = fs.readFileSync(ciPath, 'utf8');
  assert.match(ciContent, /pull_request/i, 'ci.yml deve rodar em pull_request');
  assert.match(ciContent, /pnpm\s+install/i, 'ci.yml deve rodar pnpm install');
  assert.match(ciContent, /typecheck|tsc/i, 'ci.yml deve rodar typecheck');
  assert.match(ciContent, /test:unit/i, 'ci.yml deve rodar test:unit');
  assert.match(ciContent, /test:mjs/i, 'ci.yml deve rodar test:mjs');
});
