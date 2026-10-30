import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { SoulWorkspace, initializeWorkspace } from '../src/workspace.ts';
import type { WorkspaceMessage, WorkspaceReply } from '../src/workspace.ts';
import type { LifeInput } from '../src/soul-types.ts';
import type { IntentionInput } from '../src/agency-types.ts';

export const workspaceHelp = `工作区闭环（只用宿主模型，无独立聊天服务）：
  workspace-init                                  安装首次引导，保留已有AGENTS与身份
  workspace-open [--text 本轮主题]                 新对话/压缩后恢复同一身份与当前快照
  workspace-receive --file <JSON路径或->            已提交用户原话；明确命名也从此入口提交
  workspace-reply --file <JSON路径或->              已公开完整回复，需引用本轮用户来源ID
  workspace-record --file <JSON路径或->             宿主提交有来源的理解/未结束话题
  workspace-intend --file <JSON路径或->             提出意愿与所需能力，不自行授权或执行
  workspace-intentions                            查看意愿及宿主回执
  workspace-idle                                  宿主空闲唤醒资料，不自动调用模型
  workspace-recall --text <主题>                   查找早期经历
  workspace-read --type memory|life --id <ID>       按ID展开
工作区选项：--workspace <目录> 默认当前目录；open/receive默认仅提供简短锚点，无全文检索。
显式 --mode recall 可组装回忆快照；--max-chars 2000至32000。
正文JSON的sessionId/messageId来自真实宿主消息并在重试时保持稳定。`;

export function workspaceCommand(command: string, flags: Record<string, string>) {
  if (!['workspace-init', 'workspace-open', 'workspace-receive', 'workspace-reply', 'workspace-record', 'workspace-recall', 'workspace-read', 'workspace-intend', 'workspace-intentions', 'workspace-idle'].includes(command)) throw new Error('未知工作区命令');
  if (flags.data) throw new Error('工作区命令依据已绑定身份，不接受--data临时换人');
  const root = resolve(flags.workspace ?? process.cwd());
  if (command === 'workspace-init') return initializeWorkspace(root, [process.execPath,
    fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? './main.ts' : './main.js', import.meta.url))]);
  const required = (key: string) => { if (!flags[key]) throw new Error(`缺少 --${key}`); return flags[key]; };
  const input = () => {
    const path = required('file'), raw = readFileSync(path === '-' ? 0 : resolve(path), 'utf8');
    if (raw.length > 64000) throw new Error('工作区请求JSON超过64000字符');
    return JSON.parse(raw.replace(/^\uFEFF/u, ''));
  };
  if (flags.mode !== undefined && flags.mode !== 'anchor' && flags.mode !== 'recall') throw new Error('mode需要anchor或recall');
  const options = { maxChars: flags['max-chars'] === undefined ? undefined : Number(flags['max-chars']), mode: flags.mode as 'anchor' | 'recall' | undefined };
  const workspace = new SoulWorkspace(root);
  try {
    if (command === 'workspace-open') return workspace.open(flags.text ?? '', options);
    if (command === 'workspace-receive') return workspace.receive(input() as WorkspaceMessage, options);
    if (command === 'workspace-reply') return workspace.reply(input() as WorkspaceReply);
    if (command === 'workspace-record') return workspace.record(input() as LifeInput);
    if (command === 'workspace-intend') return workspace.intend(input() as IntentionInput);
    if (command === 'workspace-intentions') return workspace.intentions();
    if (command === 'workspace-idle') return workspace.idle();
    if (command === 'workspace-recall') return workspace.recall(required('text'));
    return workspace.read(required('type'), required('id'));
  } finally { workspace.close(); }
}
