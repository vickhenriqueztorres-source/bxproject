import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Test-only ESM loader: exercises API and wallet adapter sources without rebuilding dist.
const sourceRoots = ['/services/api/src/', '/services/wallet-adapter/src/'];
const isTestSource = url => sourceRoots.some(root => url.includes(root));
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL && isTestSource(context.parentURL)) {
    const candidate = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
    try {
      if ((await stat(candidate)).isFile()) return { url: candidate.href, shortCircuit: true };
    } catch { /* Let Node resolve the original import. */ }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') && isTestSource(url)) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: fileURLToPath(url), reportDiagnostics: true,
    });
    const errors = output.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [];
    if (errors.length) throw new Error(`TypeScript test loader: ${errors.map(d => d.messageText).join('; ')}`);
    return { format: 'module', source: output.outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
