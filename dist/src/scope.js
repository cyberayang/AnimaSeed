import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import * as v from './validation.js';
export const SCOPE_FILE = 'scope.json';
export const DEFAULT_SCOPE = { version: 1, scope: 'companion-only', companionDirs: [], excludeDirs: [] };
function normalizeDirs(value, field) {
    if (value === undefined)
        return [];
    const list = v.list(value, 64);
    return list.map(item => {
        const dir = v.text(item, field, 4096).trim();
        if (!isAbsolute(dir))
            throw new Error(`${field} 需要绝对路径：${JSON.stringify(item)}`);
        return dir;
    });
}
export function parseScope(input) {
    const row = v.object(input);
    if (row.version !== undefined && row.version !== 1)
        throw new Error('scope.json 版本不支持');
    const scope = row.scope === undefined ? 'companion-only' : row.scope;
    if (scope !== 'companion-only' && scope !== 'exclude' && scope !== 'all')
        throw new Error('scope 需要 companion-only、exclude 或 all');
    return { version: 1, scope, companionDirs: normalizeDirs(row.companionDirs, 'companionDirs'),
        excludeDirs: normalizeDirs(row.excludeDirs, 'excludeDirs') };
}
export function readScope(dataDir) {
    const path = join(dataDir, SCOPE_FILE);
    if (!existsSync(path))
        return undefined;
    return parseScope(JSON.parse(readFileSync(path, 'utf8')));
}
export function writeScope(dataDir, input) {
    const settings = parseScope({ version: 1, ...v.object(input) });
    mkdirSync(dataDir, { recursive: true });
    const path = join(dataDir, SCOPE_FILE);
    writeFileSync(path, JSON.stringify(settings, null, 2) + '\n');
    return { path, settings };
}
