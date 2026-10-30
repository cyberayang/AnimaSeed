#!/usr/bin/env node
import { resolve } from 'node:path';
import { SoulCore, SoulWorkspace, loadSoulArchive, saveSoulArchive } from '../src/index.ts';
import { startOnboarding } from './onboarding.ts';
import { workspaceCommand, workspaceHelp } from './workspace.ts';

const help = `AnimaSeed · 灵芽 0.3 · Node.js 24.14+
node cli/main.ts <命令> [选项]
  start                                           首次交互命名，已有身份则继续
  init / status                                   查看等待命名或当前人生状态
  name --name 小禾 [--by 抚养者]                  明确确认首次命名与出生
  say --text "今天想聊的话"                       记录真实交流，不直接改写观点
  recall --text "想查找的经历"                    检索人生与原件
  read --type life|memory --id <ID>                 展开原件或人生记录
  timeline                                        查看近期人生时间线
  sleep                                           评估已有成长证据，不调用云端
  export --file <路径> [--password-env 变量名]      导出完整人生档案
  import --file <路径> [--password-env 变量名]      导入到空目录
管理入口，与日常交流分开：
  privacy-forget --type life|memory --id <ID> --confirm <身份ID> [--match 明确的私人词组]
  adopt-legacy --confirm <旧身份ID>
通用选项：--data <目录>，默认当前项目 data/soul。
密码只从环境变量读取，至少12字符。日常接口不提供人格覆盖和直接遗忘。
隐私清除只作用于当前数据目录及后续导出，宿主日志和旧备份需另行处理。
${workspaceHelp}`;

export async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help') { console.log(help); return; }
  if (command === 'forget' || command === 'correct') throw new Error('日常接口不再直接删除或覆盖人生；隐私清除请使用独立的privacy-forget管理命令');
  if (!command.startsWith('workspace-') && !['start', 'init', 'status', 'name', 'say', 'recall', 'read', 'timeline', 'sleep', 'export', 'import', 'privacy-forget', 'adopt-legacy'].includes(command)) throw new Error('未知命令，请运行 --help');
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith('--') || rest[i + 1] === undefined || rest[i + 1].startsWith('--')) throw new Error('选项需要明确的值');
    flags[rest[i].slice(2)] = rest[i + 1];
  }
  if (command.startsWith('workspace-')) { console.log(JSON.stringify(workspaceCommand(command, flags), null, 2)); return; }
  if (command === 'start' && !flags.data) {
    workspaceCommand('workspace-init', flags);
    const workspace = new SoulWorkspace(resolve(flags.workspace ?? process.cwd()));
    try { await startOnboarding(workspace.soul); } finally { workspace.close(); }
    return;
  }
  const required = (name: string) => { if (!flags[name]) throw new Error(`缺少 --${name}`); return flags[name]; };
  const dataDir = resolve(flags.data ?? resolve(process.cwd(), 'data/soul'));
  const password = flags['password-env'] ? process.env[flags['password-env']] : undefined;
  if (flags['password-env'] && !password) throw new Error('指定的密码环境变量为空');
  if (command === 'import') {
    const soul = SoulCore.restore(loadSoulArchive(resolve(required('file')), password), { dataDir });
    try { console.log(JSON.stringify(soul.state(), null, 2)); } finally { soul.close(); }
    return;
  }
  const soul = new SoulCore({ dataDir });
  try {
    let result: unknown;
    if (command === 'start') { await startOnboarding(soul); return; }
    if (command === 'init' || command === 'status') result = soul.state();
    if (command === 'name') {
      const name = required('name');
      result = soul.name({ name, namedBy: flags.by ?? '抚养者', sessionId: 'local-onboarding',
        messageId: crypto.randomUUID(), text: '给你起名：' + name });
    }
    if (command === 'say') result = soul.observe({ sessionId: 'local-dialogue', messageId: crypto.randomUUID(), role: 'user', text: required('text') });
    if (command === 'recall') result = soul.recall(required('text'));
    if (command === 'read') {
      const type = required('type');
      if (type !== 'life' && type !== 'memory') throw new Error('type需要life或memory');
      const row = type === 'life' ? soul.life(required('id')) : soul.memory(required('id'));
      result = row && row.status !== 'redacted' && row.status !== 'forgotten' ? row : { id: flags.id, unavailable: true };
    }
    if (command === 'timeline') result = soul.timeline();
    if (command === 'sleep') result = soul.sleep();
    if (command === 'adopt-legacy' || command === 'privacy-forget') {
      if (required('confirm') !== soul.lifecycle().id) throw new Error('管理操作需明确确认当前身份ID');
      if (command === 'adopt-legacy') result = soul.adoptLegacy(true);
      else {
        const type = required('type');
        if (type !== 'life' && type !== 'memory') throw new Error('type需要life或memory');
        result = soul.privacyForget({ type, id: required('id'), match: flags.match });
      }
    }
    if (command === 'export') {
      const path = resolve(required('file')); saveSoulArchive(soul.export(), path, password);
      result = { exported: path, encrypted: !!password, identityId: soul.lifecycle().id };
    }
    console.log(JSON.stringify(result, null, 2));
  } finally { soul.close(); }
}
try { await main(process.argv.slice(2)); }
catch (error) { console.error(error instanceof Error ? error.message : '灵魂核心操作失败'); process.exitCode = 1; }
