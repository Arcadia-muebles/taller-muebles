import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

// Run actual server actions and repositories outside Next's request runtime.
// Only framework request primitives are substituted; persistence is real.
export function loadApp() {
  const cache = new Map();
  const cookieJar = new Map();
  const mocks = {
    'server-only': {},
    'next/cache': { revalidatePath() {} },
    'next/headers': { cookies: async () => ({
      get: (name) => cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
      set: (name, value) => cookieJar.set(name, value),
      delete: (name) => cookieJar.delete(name),
    }) },
    'next/navigation': { redirect: (url) => { throw new Error(`REDIRECT:${url}`); } },
  };
  function load(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const nativeRequire = createRequire(filename);
    const requireModule = (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(filename), name);
        const source = [target, `${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')].find(existsSync);
        if (source && /\.tsx?$/.test(source)) return load(source);
      }
      return nativeRequire(name);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    new Function('require', 'module', 'exports', outputText)(requireModule, mod, mod.exports);
    return mod.exports;
  }
  return { load, cookieJar };
}
