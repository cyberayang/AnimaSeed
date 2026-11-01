import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SoulWorkspace, initializeWorkspace } from '../src/index.ts';

// 演示一个非 dsh 的宿主如何通过本地 SDK 接入同一份人生档案。
// 流程对应用户指南的四步：open -> receive ->（可选 recall）-> reply -> record。
// 这里用虚构数据与假模型，不调用任何收费模型，也不联网。

const qaRoot = resolve(import.meta.dirname, '../.qa');
mkdirSync(qaRoot, { recursive: true });
const workspaceDir = mkdtempSync(join(qaRoot, 'bridge-'));

// 宿主执行核心命令的参数（真实宿主据此启动 CLI，或直接走 SDK）。
const cli = [process.execPath, fileURLToPath(new URL('../dist/cli/main.js', import.meta.url))];

try {
  // 1. 首次安装引导：建立等待命名的档案与 .soul/workspace.json 绑定。
  initializeWorkspace(workspaceDir, cli);

  // 2. 第一段“宿主进程”：open -> receive -> reply -> record -> recall。
  let soulId: string;
  {
    const workspace = new SoulWorkspace(workspaceDir);
    try {
      const sessionId = 'host-session-1';
      const opening = workspace.open('今天的相处');
      console.log('需要命名：', opening.namingRequired, '（未命名时不保存出生前经历）');
      soulId = opening.soulId;

      // 用户原话提交，同时以“明确命名”完成出生。
      const first = workspace.receive({ sessionId, messageId: 'user-1', text: '给你起名：桥桥' });
      console.log('命名后状态：', first.status, '，名字：', first.name, '，sourceId：', first.sourceId);

      // 普通交流：保存用户原话，拿到 sourceId 供回复引用。
      const heard = workspace.receive({ sessionId, messageId: 'user-2', text: '下次我们继续聊聊安静地看书这件事。' });
      console.log('本条状态：', heard.status, '，sourceId：', heard.sourceId);

      // 宿主实际展示完整回复后再提交公开回复，必须引用同一会话的用户来源。
      const reply = workspace.reply({ sessionId, messageId: 'assistant-1',
        inReplyTo: heard.sourceId!, text: '好呀，下次继续聊安静看书的感觉。' });
      console.log('公开回复已保存：', reply.id);

      // 模型自主保存一条有来源的认识（引文必须是真实存在的原话片段）。
      workspace.record({ kind: 'interest', topic: '安静看书', text: '想继续理解安静看书的感觉',
        citations: [{ type: 'memory', id: heard.sourceId!, quote: '安静地看书这件事' }] });

      // 需要旧事时按主题检索，返回原始经历（memories）与人生条目（life）。
      const found = workspace.recall('看书');
      console.log('检索命中原件：', found.memories.length, '条，人生条目：', found.life.length, '条');
      console.log('首条人生主题：', found.life[0]?.topic ?? '无');
    } finally { workspace.close(); }
  }

  // 3. 换“宿主进程”：重新打开同一工作区，接续同一身份与关注。
  {
    const reopened = new SoulWorkspace(workspaceDir);
    try {
      const frame = reopened.open('继续上次的话题');
      console.log('重开后同一身份：', frame.soulId === soulId);
      console.log('身份锚点片段：', frame.context.text.slice(0, 80).replace(/\n/g, ' '));
    } finally { reopened.close(); }
  }

  console.log('=== host-bridge 演示完成 ===');
} finally {
  const name = relative(qaRoot, workspaceDir);
  if (!name.startsWith('bridge-') || name.includes('/') || name.includes('\\')) throw new Error('演示清理路径超出本项目QA目录');
  rmSync(workspaceDir, { recursive: true, force: true });
}
