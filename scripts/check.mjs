import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..'), modules = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(ts|mjs)$/u.test(entry.name)) modules.push(path);
  }
}
for (const name of ['src', 'adapters', 'cli', 'scripts', 'examples', 'test']) walk(join(root, name));
const graph = new Map();
for (const path of modules) {
  const content = readFileSync(path, 'utf8');
  if (content.split('\n').length > 300) throw new Error(`模块超过300行: ${path}`);
  const imports = [...content.matchAll(/^\s*(?:import\s+(?:[^'"\n]*?\s+from\s*)?|export\s+[^'"\n]*?\s+from\s*)['"]([^'"]+)['"]/gmu)].map(x => x[1]);
  if (path.startsWith(join(root, 'src')) && imports.some(x => !x.startsWith('.') && !x.startsWith('node:'))) throw new Error(`核心不能依赖第三方运行时: ${path}`);
  graph.set(path, imports.filter(x => x.startsWith('.')).map(x => resolve(dirname(path), x)));
}
const done = new Set(), pending = new Set();
function visit(path) {
  if (pending.has(path)) throw new Error(`循环依赖: ${path}`);
  if (done.has(path)) return;
  pending.add(path);
  for (const dependency of graph.get(path) ?? []) visit(dependency);
  pending.delete(path); done.add(path);
}
modules.forEach(visit);
console.log(`模块检查通过：${modules.length}个模块，核心无第三方运行时依赖，无循环依赖。`);
