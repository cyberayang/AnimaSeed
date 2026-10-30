import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SoulCore } from './soul-core.ts';
import { SOUL_RULES } from './soul-context.ts';
import type { SoulContextOptions } from './soul-context.ts';
import { contextBudget } from './soul-context.ts';
import type { IntentionInput } from './agency-types.ts';
import type { LifeInput } from './soul-types.ts';
import { namingPhrase } from './soul-lifecycle.ts';
import { WORKSPACE_MARKER, workspaceGuide } from './workspace-guide.ts';
import * as v from './validation.ts';

interface Binding { version: 1; soulId: string; dataDir: 'data/soul' }
export interface WorkspaceMessage { sessionId: string; messageId: string; text: string }
export interface WorkspaceReply extends WorkspaceMessage { inReplyTo: string }
const configPath = (root: string) => join(root, '.soul', 'workspace.json');
function readBinding(root: string): Binding {
  if (!existsSync(configPath(root))) throw new Error('工作区尚未初始化，请先运行 workspace-init');
  const data = v.object(JSON.parse(readFileSync(configPath(root), 'utf8')));
  if (data.version !== 1 || data.dataDir !== 'data/soul') throw new Error('工作区绑定格式不支持；不能隐式换用其他人生目录');
  return { version: 1, soulId: v.text(data.soulId, '绑定身份ID', 100), dataDir: 'data/soul' };
}
function message(input: unknown): WorkspaceMessage {
  const row = v.object(input);
  return { sessionId: v.text(row.sessionId, '会话ID', 200), messageId: v.text(row.messageId, '消息ID', 200), text: v.text(row.text, '真实发言') };
}

export class SoulWorkspace {
  readonly soul: SoulCore;
  readonly workspaceDir: string;
  constructor(workspaceDir: string) {
    this.workspaceDir = realpathSync(resolve(workspaceDir));
    const binding = readBinding(this.workspaceDir), dataDir = join(this.workspaceDir, binding.dataDir);
    if (!existsSync(join(dataDir, 'memory.sqlite'))) throw new Error('已绑定的人生档案缺失，拒绝自动创建新身份；请恢复原档案');
    this.soul = new SoulCore({ dataDir });
    try {
      if (this.soul.lifecycle().id !== binding.soulId) throw new Error('工作区身份与档案不符，拒绝换人；请检查绑定与原档案');
      if (this.soul.lifecycle().phase === 'legacy') throw new Error('旧身份需要在独立管理入口显式接续');
    } catch (error) { this.soul.close(); throw error; }
  }
  open(query = '', options: SoulContextOptions = {}) {
    if (typeof query !== 'string' || query.length > 16000) throw new Error('本轮主题应为不超过16000字符的文本');
    const lifecycle = this.soul.lifecycle();
    return { protocol: 'soul-workspace/1', soulId: lifecycle.id, name: lifecycle.name,
      namingRequired: lifecycle.phase === 'awaiting-name', rules: SOUL_RULES, context: this.soul.context(query, options) };
  }
  receive(input: WorkspaceMessage, options: SoulContextOptions = {}) {
    const value = message(input), name = namingPhrase(value.text);
    // Validate the requested context budget before committing a new experience.
    contextBudget(value.text, options);
    const lifecycle = this.soul.lifecycle();
    if (lifecycle.phase === 'awaiting-name') {
      if (!name) return { ...this.open(value.text, options), status: 'needs-name', sourceId: null };
      this.soul.name({ ...value, name, namedBy: '抚养者' });
    }
    const source = this.soul.observe({ ...value, role: 'user' });
    if (source.status === 'forgotten') throw new Error('该消息已隐私清除，不能重新写入或继续引用');
    return { ...this.open(value.text, options), status: 'received', sourceId: source.id };
  }
  reply(input: WorkspaceReply) {
    const value = message(input), inReplyTo = v.text(v.object(input).inReplyTo, '本轮用户来源ID', 100);
    return this.soul.reply({ ...value, inReplyTo });
  }
  record(input: LifeInput) { return this.soul.record(input); }
  intend(input: IntentionInput) { return { intention: this.soul.intend(input), handoff: 'host', permissionGranted: false }; }
  intentions() { return this.soul.intentions(); }
  idle() { return this.soul.idle(); }
  recall(query: string) { return this.soul.recall(query); }
  read(type: string, id: string) {
    if (type !== 'memory' && type !== 'life') throw new Error('type需要memory或life');
    const row = type === 'memory' ? this.soul.memory(id) : this.soul.life(id);
    return row && row.status !== 'forgotten' && row.status !== 'redacted' ? row : { id, unavailable: true };
  }
  close() { this.soul.close(); }
}

export function initializeWorkspace(workspaceDir: string, command: string[]) {
  if (!command.length || command.some(x => typeof x !== 'string' || !x)) throw new Error('需要宿主可执行的核心命令参数');
  const root = realpathSync(resolve(workspaceDir)), directory = join(root, '.soul');
  const agentsPath = join(root, 'AGENTS.md'), ignorePath = join(root, '.gitignore');
  const agents = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : '';
  const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : '';
  const start = '<!-- soul-core:workspace:start -->', end = '<!-- soul-core:workspace:end -->';
  const starts = agents.split(start).length - 1, ends = agents.split(end).length - 1;
  if (starts !== ends || starts > 1 || (starts && agents.indexOf(start) > agents.indexOf(end))) throw new Error('AGENTS中的工作区引导标记不完整或重复，请先修复');
  if (existsSync(configPath(root))) {
    const workspace = new SoulWorkspace(root);
    try { return install(workspace); } finally { workspace.close(); }
  }
  const soul = new SoulCore({ dataDir: join(root, 'data/soul') });
  try {
    if (soul.lifecycle().phase === 'legacy') throw new Error('旧身份需要先在管理入口明确接续，初始化不会自动迁移');
    mkdirSync(directory, { recursive: true });
    const binding: Binding = { version: 1, soulId: soul.lifecycle().id, dataDir: 'data/soul' };
    writeFileSync(configPath(root), JSON.stringify(binding, null, 2) + '\n', { flag: 'wx' });
  } finally { soul.close(); }
  const workspace = new SoulWorkspace(root);
  try { return install(workspace); } finally { workspace.close(); }

  function install(workspace: SoulWorkspace) {
    const nextAgents = agents.includes(start)
      ? agents.replace(/<!-- soul-core:workspace:start -->[\s\S]*?<!-- soul-core:workspace:end -->/u, () => WORKSPACE_MARKER)
      : agents + (agents.endsWith('\n') || !agents ? '' : '\n') + '\n' + WORKSPACE_MARKER + '\n';
    writeFileSync(agentsPath, nextAgents);
    // Last matching gitignore rule wins, including over earlier allow rules.
    if (!ignore.endsWith('# soul-core private life\n/.soul/\n/data/soul/\n')) {
      writeFileSync(ignorePath, ignore + (ignore.endsWith('\n') || !ignore ? '' : '\n') + '# soul-core private life\n/.soul/\n/data/soul/\n');
    }
    writeFileSync(join(directory, 'GUIDE.md'), workspaceGuide(command, root));
    return { ...workspace.open(), workspaceDir: root, guide: join(directory, 'GUIDE.md') };
  }
}
