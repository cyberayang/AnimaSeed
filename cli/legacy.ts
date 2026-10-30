#!/usr/bin/env node
// Explicit 0.1 archive management only. Soul-schema databases reject this legacy API.
import { resolve } from 'node:path';
import { MemoryCore, loadPackage, savePackage } from '../src/index.ts';

const help = `记忆核心：仅管理记忆、身份与可迁移状态。Node.js 24.14+
node cli/main.ts <命令> [选项]
  init       --name 阿一                         初始化独立身份
  status                                          查看身份和数量
  remember   --text "请记住：我喜欢安静"          记录用户提供的原文
  recall     --text "我喜欢什么"                 检索有效记忆
  read       --id <记忆ID>                         查看有效内容或失效状态
  correct    --id <整理记忆ID> --text "新的事实"   记录新证据并纠正旧记忆
  forget     --id <记忆ID>                         遗忘来源及衍生内容
  sleep                                           本地整理、跨日反馈学习、过期处理
  export     --file <路径> [--password-env 变量名]  导出迁移包
  import     --file <路径> [--password-env 变量名]  导入到空数据目录
通用选项：--data <绝对或相对路径>，默认项目 data/default。
密码使用环境变量传入，至少12字符；不把密码写进命令参数。
forget只清除此数据目录；宿主旧对话和已有备份需另行处理。`;

export function main(argv: string[]): void {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help') { console.log(help); return; }
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith('--') || rest[i + 1] === undefined || rest[i + 1].startsWith('--')) throw new Error('选项需要明确的值');
    flags[rest[i].slice(2)] = rest[i + 1];
  }
  if (!['init', 'status', 'remember', 'recall', 'read', 'correct', 'forget', 'sleep', 'export', 'import'].includes(command)) throw new Error('未知命令，请运行 --help');
  const required = (name: string) => { if (!flags[name]) throw new Error(`缺少 --${name}`); return flags[name]; };
  const dataDir = resolve(flags.data ?? resolve(process.cwd(), 'data/default'));
  const password = flags['password-env'] ? process.env[flags['password-env']] : undefined;
  if (flags['password-env'] && !password) throw new Error('指定的密码环境变量为空');
  if (command === 'import') {
    const core = MemoryCore.restore(loadPackage(resolve(required('file')), password), { dataDir });
    try { console.log(JSON.stringify(core.status(), null, 2)); } finally { core.close(); }
    return;
  }
  const core = new MemoryCore({ dataDir, name: flags.name });
  try {
    let result: unknown;
    if (command === 'init' || command === 'status') result = core.status();
    if (command === 'remember') {
      const source = core.observe({ sessionId: 'local-owner', messageId: crypto.randomUUID(), role: 'user', text: required('text') });
      result = core.remember({ kind: 'fact', text: source.text, citations: [{ id: source.id, quote: source.text }], importance: 0.85, confidence: 1, pinned: true });
    }
    if (command === 'recall') result = core.recall(required('text'));
    if (command === 'read') {
      const row = core.get(required('id'));
      result = row?.status === 'active' ? row : { id: flags.id, status: row?.status ?? 'unknown' };
    }
    if (command === 'correct') {
      const source = core.observe({ sessionId: 'local-owner', messageId: crypto.randomUUID(), role: 'user', text: required('text') });
      result = core.correct(required('id'), source.text, [{ id: source.id, quote: source.text }]);
    }
    if (command === 'forget') result = core.forget(required('id'));
    if (command === 'sleep') result = core.sleep();
    if (command === 'export') {
      const path = resolve(required('file'));
      savePackage(core.export(), path, password);
      result = { exported: path, encrypted: !!password, identityId: core.identity().id };
    }
    console.log(JSON.stringify(result, null, 2));
  } finally { core.close(); }
}
try { main(process.argv.slice(2)); }
catch (error) { console.error(error instanceof Error ? error.message : '记忆核心操作失败'); process.exitCode = 1; }
