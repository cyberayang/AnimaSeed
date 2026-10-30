import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { SoulCore } from '../src/index.ts';

const qa = resolve(import.meta.dirname, '../.qa');
mkdirSync(qa, { recursive: true });
const directory = mkdtempSync(join(qa, 'demo-'));
try {
  let core = new SoulCore({ dataDir: directory });
  console.log('首次打开：', core.lifecycle().phase, '（等待命名，没有默认名字）');
  core.name({ name: '演示伙伴', namedBy: '演示抚养者', sessionId: '窗口一', messageId: 'name', text: '给你起名：演示伙伴' });
  const identityId = core.lifecycle().id;
  const event = core.observe({ sessionId: '窗口一', messageId: '1', role: 'user', text: '我们可以慢慢讨论怎样安静地陪伴。' });
  core.record({ kind: 'interest', topic: '安静陪伴', text: '想继续理解怎样安静地陪伴',
    citations: [{ type: 'memory', id: event.id, quote: event.text }] });
  core.sleep(); core.close();
  core = new SoulCore({ dataDir: directory });
  console.log('新窗口，身份保持一致：', core.lifecycle().id === identityId);
  console.log('发展阶段：', core.state().development.label, '，诞生时长：', core.state().development.bornDays, '天');
  console.log(core.context('我们上次聊到哪里了？').text);
  core.close();
} finally {
  const child = relative(qa, resolve(directory));
  if (!child.startsWith('demo-') || child.includes('/') || child.includes('\\')) throw new Error('演示清理路径超出本项目QA目录');
  rmSync(directory, { recursive: true, force: true });
}
